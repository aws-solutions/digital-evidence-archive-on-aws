/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getDeaUserFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
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
  const idToken = getRequiredHeader(event, 'idToken');
  const idTokenPayload = await getTokenPayload(idToken, process.env.AWS_REGION ?? 'us-east-1');
  const deaRole = idTokenPayload['custom:DEARole'] ? String(idTokenPayload['custom:DEARole']) : undefined;
  if (!deaRole) {
    logger.error(
      'PreExecution checks running without/invalid DEARole in token: ' + idTokenPayload['custom:DEARole']
    );
    throw new NotFoundError('Resource Not Found');
  }
  // got token payload - progress audit identity
  auditEvent.actorIdentity = {
    idType: IdentityType.COGNITO_TOKEN,
    sourceIp: event.requestContext.identity.sourceIp,
    id: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    deaRole,
  };
  const tokenSub = idTokenPayload.sub;
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
    id: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    firstName: maybeUser.firstName,
    lastName: maybeUser.lastName,
    userUlid,
    deaRole,
  };

  event.headers['userUlid'] = userUlid;

  // We use the jti from the token as a unique identitfier
  // for the token to distinguish between sessions for a user
  const tokenId = idTokenPayload.jti;
  // This jti will be used for refresh/revoke endpoints
  // to invalidate the current session. For refresh this will
  // allow the new session to meet session reqs without waiting for
  // the first to expire. For revoke, this blocks further
  // access to the system with the id token, since it will
  // not meet sessions reqs if it is revoked
  event.headers['tokenJti'] = tokenId;

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

export const responseOk = (body: unknown): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};

export const csvResponse = (csvData: string): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    body: csvData,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="case_audit_${new Date().toDateString()}"`,
      'Access-Control-Allow-Origin': '*',
    },
  };
};

export const responseNoContent = (): APIGatewayProxyResult => {
  return {
    statusCode: 204,
    body: '',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
