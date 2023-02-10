/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { getDeaUserFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getRequiredHeader } from '../../lambda-http-helpers';
import { DeaUser } from '../../models/user';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import * as UserService from '../services/user-service';
import { LambdaContext, LambdaEvent, LambdaRepositoryProvider } from './dea-gateway-proxy-handler';

export type DEAPreLambdaExecutionChecks = (
  event: LambdaEvent,
  context: LambdaContext,
  repositoryProvider: LambdaRepositoryProvider
) => Promise<void>;

export const runPreExecutionChecks = async (
  event: LambdaEvent,
  context: LambdaContext,
  repositoryProvider = defaultProvider
) => {
  // add first time federated users to the database
  // NOTE: we use the sub from the id token (from user pool not id pool) passed in the
  // header to as the unique id, since we cannot verify identity id from client is trustworthy
  // since it is not encoded from the id pool
  // Additionally we get the first and last name of the user from the id token
  const idToken = getRequiredHeader(event, 'idToken');
  const idTokenPayload = await getTokenPayload(idToken, process.env.AWS_REGION ?? 'us-east-1');
  const tokenId = idTokenPayload.sub;
  const maybeUser = await getUserFromTokenId(tokenId, repositoryProvider);
  if (!maybeUser) {
    // Create the user in the database and store the new user's ulid
    // into the event, so lambda execution code does not need to
    // reverify and decode the token and call the ddb for the user
    event.headers['userUlid'] = await addUserToDatabase(idTokenPayload, repositoryProvider);
  } else {
    // User already exist, store its ulid in the event so lambda execution code does not need to
    // reverify and decode the token and call the ddb for the user
    event.headers['userUlid'] = maybeUser.ulid;
  }

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
): Promise<string> => {
  const deaUser = await getDeaUserFromToken(payload);

  const deaUserResult = await UserService.createUser(deaUser, repositoryProvider);
  if (!deaUserResult.ulid) {
    throw new ValidationError('Unable to add newly federated user to the database');
  }

  return deaUserResult.ulid;
};

// Session Management Checks Helper Functions

// TODO: Add these
