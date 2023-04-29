/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDeaUserFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getAllowedOrigins, getOauthToken, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { Oauth2Token } from '../../models/auth';
import { DeaUser } from '../../models/user';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ReauthenticationError } from '../exceptions/reauthentication-exception';
import { CJISAuditEventBody, IdentityType } from '../services/audit-service';
import * as SessionService from '../services/session-service';
import * as UserService from '../services/user-service';
import { LambdaContext, LambdaEvent, LambdaRepositoryProvider } from './dea-gateway-proxy-handler';

export type DEAPreLambdaExecutionChecks = (
  event: LambdaEvent,
  context: LambdaContext,
  auditEvent: CJISAuditEventBody,
  repositoryProvider: LambdaRepositoryProvider
) => Promise<void>;

const allowedOrigins = getAllowedOrigins();

export const runPreExecutionChecks = async (
  event: LambdaEvent,
  context: LambdaContext,
  auditEvent: CJISAuditEventBody,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  if (!event.requestContext.identity.cognitoIdentityId) {
    logger.error('PreExecution checks running without cognitoId');
    throw new NotFoundError('Resource Not Found');
  }
  // add first time federated users to the database
  // NOTE: we use the sub from the id token (from user pool not id pool) passed in the
  // header to as the unique id, since we cannot verify identity id from client is trustworthy
  // since it is not encoded from the id pool
  // Additionally we get the first and last name of the user from the id token
  const idToken = getOauthToken(event).id_token;
  const idTokenPayload = await getTokenPayload(idToken, process.env.AWS_REGION ?? 'us-east-1');
  const deaRole = idTokenPayload['custom:DEARole'] ? String(idTokenPayload['custom:DEARole']) : undefined;
  if (!deaRole) {
    logger.error(
      'PreExecution checks running without/invalid DEARole in token: ' + idTokenPayload['custom:DEARole']
    );
    throw new NotFoundError('Resource Not Found');
  }
  event.headers['deaRole'] = deaRole;
  const tokenSub = idTokenPayload.sub;
  // got token payload - progress audit identity
  auditEvent.actorIdentity = {
    idType: IdentityType.COGNITO_TOKEN,
    sourceIp: event.requestContext.identity.sourceIp,
    idPoolUserId: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    deaRole,
    userPoolUserId: tokenSub,
  };
  let maybeUser = await getUserFromTokenId(tokenSub, repositoryProvider);
  if (!maybeUser) {
    // Create the user in the database and store the new user's ulid
    // into the event, so lambda execution code does not need to
    // reverify and decode the token and call the ddb for the user
    maybeUser = await addUserToDatabase(idTokenPayload, repositoryProvider);
  }
  // progress audit identity
  const userUlid = maybeUser.ulid;
  auditEvent.actorIdentity = {
    idType: IdentityType.FULL_USER_ID,
    sourceIp: event.requestContext.identity.sourceIp,
    idPoolUserId: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    firstName: maybeUser.firstName,
    lastName: maybeUser.lastName,
    userUlid,
    deaRole,
    userPoolUserId: tokenSub,
  };

  event.headers['userUlid'] = userUlid;

  // We use the origin_jti from the token as a unique identitfier
  // for the token to distinguish between sessions for a user
  // Therefore if the session is marked as revoked/expired,
  // then the user has to Reauthenticate, can cannot use
  // the refresh token to get a new valid token
  // (CJIS requires reauthentication for session requirement failures)
  const tokenId = idTokenPayload.origin_jti;
  event.headers['tokenId'] = tokenId;

  // Verify the session management requirements here
  // E.g. no concurrent sessions and session lock after 30 minutes
  // of inactivity
  const sessionCheckResponse = await SessionService.isCurrentSessionValid(
    userUlid,
    tokenId,
    repositoryProvider
  );
  if (typeof sessionCheckResponse === 'string') {
    logger.error(sessionCheckResponse);
    throw new ReauthenticationError(sessionCheckResponse);
  } else {
    if (sessionCheckResponse) {
      logger.info('User ' + userUlid + ' passed session requirements');
      // Revoke older sessions if any
      const sessionsForUser = (await SessionService.getSessionsForUser(userUlid, repositoryProvider))
        .filter((session) => session.tokenId !== tokenId)
        .filter((session) => !session.isRevoked);
      for (const session of sessionsForUser) {
        await SessionService.markSessionAsRevoked(userUlid, session.tokenId, repositoryProvider);
      }
    } else {
      const errString = 'Something went wrong during session requirements check';
      logger.error(errString);
      throw new ReauthenticationError(errString);
    }
  }
};

// ------------------- HELPER FUNCTIONS -------------------

// First time Federated User Helper Functions

const getUserFromTokenId = async (
  tokenId: string,
  repositoryProvider: LambdaRepositoryProvider
): Promise<DeaUser | undefined> => {
  return UserService.getUserUsingTokenId(tokenId, repositoryProvider);
};

const addUserToDatabase = async (
  payload: CognitoIdTokenPayload,
  repositoryProvider: LambdaRepositoryProvider
): Promise<DeaUser> => {
  const deaUser = await getDeaUserFromToken(payload);

  const deaUserResult = await UserService.createUser(deaUser, repositoryProvider);

  return deaUserResult;
};

export const withAllowedOrigin = (event: APIGatewayProxyEvent, response: APIGatewayProxyResult) => {
  const requestHost = event.headers['origin'];
  if (requestHost && allowedOrigins.includes(requestHost)) {
    if (!response.headers) {
      response.headers = {};
    }
    response.headers['Access-Control-Allow-Origin'] = requestHost;
    response.headers['Access-Control-Allow-Credentials'] = true;
  }
  return response;
};

export const responseOk = (event: APIGatewayProxyEvent, body: unknown): APIGatewayProxyResult => {
  return withAllowedOrigin(event, {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {},
  });
};

export const okSetIdTokenCookie = (
  event: APIGatewayProxyEvent,
  idToken: Oauth2Token,
  body: string
): APIGatewayProxyResult => {
  const sameSiteValue = getRequiredEnv('SAMESITE');
  return withAllowedOrigin(event, {
    statusCode: 200,
    body,
    headers: {
      'Set-Cookie': `idToken=${JSON.stringify(idToken)}; Path=/; SameSite=${sameSiteValue}; Secure; HttpOnly`,
      'Access-Control-Allow-Credential': 'true',
    },
  });
};

export const csvResponse = (event: APIGatewayProxyEvent, csvData: string): APIGatewayProxyResult => {
  return withAllowedOrigin(event, {
    statusCode: 200,
    body: csvData,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="case_audit_${new Date().toDateString()}"`,
    },
  });
};

export const responseNoContent = (event: APIGatewayProxyEvent): APIGatewayProxyResult => {
  return withAllowedOrigin(event, {
    statusCode: 204,
    body: '',
    headers: {},
  });
};
