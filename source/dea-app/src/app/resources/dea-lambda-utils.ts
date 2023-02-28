/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { getDeaUserFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaUser } from '../../models/user';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { CJISAuditEventBody, IdentityType } from '../services/audit-service';
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
  // got token payload - progress audit identity
  auditEvent.actorIdentity = {
    idType: IdentityType.COGNITO_TOKEN,
    sourceIp: event.requestContext.identity.sourceIp,
    id: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
  };
  const tokenId = idTokenPayload.sub;
  let maybeUser = await getUserFromTokenId(tokenId, repositoryProvider);
  if (!maybeUser) {
    // Create the user in the database and store the new user's ulid
    // into the event, so lambda execution code does not need to
    // reverify and decode the token and call the ddb for the user
    maybeUser = await addUserToDatabase(idTokenPayload, repositoryProvider);
  }
  // progress audit identity
  auditEvent.actorIdentity = {
    idType: IdentityType.FULL_USER_ID,
    sourceIp: event.requestContext.identity.sourceIp,
    id: event.requestContext.identity.cognitoIdentityId,
    username: idTokenPayload['cognito:username'],
    firstName: maybeUser.firstName,
    lastName: maybeUser.lastName,
    userUlid: maybeUser.ulid,
  };

  event.headers['userUlid'] = maybeUser.ulid;

  // TODO: verify the session management requirements here
  // E.g. no concurrent sessions and session lock after 30 minutes
  // of inactivity
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

// Session Management Checks Helper Functions

// TODO: Add these
