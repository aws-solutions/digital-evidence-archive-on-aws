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
import { defaultParametersProvider } from '../../storage/parameters';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ReauthenticationError } from '../exceptions/reauthentication-exception';
import { CJISAuditEventBody, IdentityType } from '../services/audit-service';
import { getUserPoolInfo } from '../services/parameter-service';
import * as SessionService from '../services/session-service';
import * as UserService from '../services/user-service';
import {
  LambdaContext,
  LambdaEvent,
  LambdaParametersProvider,
  LambdaRepositoryProvider,
} from './dea-gateway-proxy-handler';

const stage = getRequiredEnv('STAGE');

export type DEAPreLambdaExecutionChecks = (
  event: LambdaEvent,
  context: LambdaContext,
  auditEvent: CJISAuditEventBody,
  repositoryProvider: LambdaRepositoryProvider,
  parametersProvider: LambdaParametersProvider
) => Promise<void>;

const allowedOrigins = getAllowedOrigins();

export const runPreExecutionChecks = async (
  event: LambdaEvent,
  context: LambdaContext,
  auditEvent: CJISAuditEventBody,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  parametersProvider = defaultParametersProvider
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
  const userPoolInfo = await getUserPoolInfo(parametersProvider);
  const idTokenPayload = await getTokenPayload(idToken, userPoolInfo);
  const deaRoleString = event.requestContext.identity.userArn;
  if (!deaRoleString) {
    logger.error(
      'PreExecution checks running without/invalid IAM Role identifier in request context: ' +
        event.requestContext.identity.userArn
    );
    throw new NotFoundError('Resource Not Found');
  }
  const deaRole = getDeaRoleFromUserArn(deaRoleString, stage);
  event.headers['deaRole'] = deaRole;
  const tokenSub = idTokenPayload.sub;
  const groupMemberships = idTokenPayload['custom:SAMLGroups']
    ? String(idTokenPayload['custom:SAMLGroups'])
    : undefined;
  // got token payload - progress audit identity
  auditEvent.actorIdentity = {
    idType: IdentityType.COGNITO_TOKEN,
    sourceIp: event.requestContext.identity.sourceIp,
    idPoolUserId: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    deaRole,
    userPoolUserId: tokenSub,
    groupMemberships,
  };
  const idPoolId = auditEvent.actorIdentity.idPoolUserId;
  let maybeUser = await getUserFromTokenId(tokenSub, repositoryProvider);
  if (!maybeUser) {
    // Create the user in the database and store the new user's ulid
    // into the event, so lambda execution code does not need to
    // reverify and decode the token and call the ddb for the user
    try {
      maybeUser = await addUserToDatabase(idTokenPayload, idPoolId, repositoryProvider);
    } catch (error) {
      throw new ReauthenticationError(
        'Something went wrong during new user registration. Please Reauthenticate.'
      );
    }
  } else {
    // To be backwards compatible, if the user obj does not have an identity id
    // then update the user in that row
    if (!maybeUser.idPoolId) {
      try {
        await UserService.addIdPoolIdToUser(maybeUser, idPoolId, repositoryProvider);
      } catch (error) {
        throw new ReauthenticationError(
          'Something went wrong during new user update. Please Reauthenticate.'
        );
      }
    }

    // Verify that the Identity Id from the audit event matches
    // whats already in the DB for this user. This check is to
    // prevent someone from using their IAM credentials with someone
    // else's id token
    else if (maybeUser.idPoolId !== idPoolId) {
      logger.error(
        'The IdPoolUserId from the audit event does NOT match what is in the DB for this user. Suspect IAM credentials mismatch with id token'
      );
      throw new ReauthenticationError('Something went wrong during execution checks. Please Reauthenticate.');
    }
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
    groupMemberships,
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

const getDeaRoleFromUserArn = (userArn: string, stageName: string): string => {
  // User ARN is in the format of
  // arn:<PARTITION>:sts::<ACCT_NUM>:assumed-role/<STAGE>-<DEARoleName>Role/CognitoIdentityCredentials
  // We want to extract the <DEARoleName>
  const regExp = new RegExp(`${stageName}-(.+(?=Role(?!.*Role)))`);
  const regMatch = userArn.match(regExp);
  let roleName = '';

  if (regMatch && regMatch[1]) {
    roleName = regMatch[1];
  }

  return roleName;
};

// First time Federated User Helper Functions

const getUserFromTokenId = async (
  tokenId: string,
  repositoryProvider: LambdaRepositoryProvider
): Promise<DeaUser | undefined> => {
  return UserService.getUserUsingTokenId(tokenId, repositoryProvider);
};

const addUserToDatabase = async (
  payload: CognitoIdTokenPayload,
  idPoolId: string,
  repositoryProvider: LambdaRepositoryProvider
): Promise<DeaUser> => {
  const deaUser = await getDeaUserFromToken(payload, idPoolId);

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
    multiValueHeaders: {
      'Set-Cookie': [
        `idToken=${JSON.stringify({
          id_token: idToken.id_token,
          expires_in: idToken.expires_in,
        })}; Path=/; SameSite=${sameSiteValue}; Secure; HttpOnly`,
        `refreshToken=${JSON.stringify({
          refresh_token: idToken.refresh_token,
        })}; Path=/; SameSite=${sameSiteValue}; Secure; HttpOnly`,
      ],
      'Access-Control-Allow-Credential': ['true'],
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
