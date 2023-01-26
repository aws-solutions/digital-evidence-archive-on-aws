/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { getDeaUserFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { getUserByTokenId } from "../../persistence/user";
import { ValidationError } from '../exceptions/validation-exception';
import * as UserService from '../services/user-service';
import { LambdaContext, LambdaEvent, LambdaRepositoryProvider } from './dea-gateway-proxy-handler';

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
    if (!event.headers["idToken"]) {
        throw new ValidationError("Header does not include the id token.");
    }
    const idTokenPayload = await getTokenPayload(event.headers["idToken"], process.env.AWS_REGION ?? "us-east-1");
    const tokenId = idTokenPayload.sub;
    if (await isFirstTimeFederatedUser(tokenId, repositoryProvider)) {
        await addUserToDatabase(idTokenPayload, repositoryProvider);
    }

    // TODO: verify the session management requirements here
    // E.g. no concurrent sessions and session lock after 30 minutes
    // of inactivity

}

// ------------------- HELPER FUNCTIONS ------------------- 

// First time Federated User Helper Functions

const isFirstTimeFederatedUser = async (tokenId: string, repositoryProvider: LambdaRepositoryProvider): Promise<boolean> => {
    const user = await getUserByTokenId(tokenId, repositoryProvider);

    return !user ? true : false;
}

const addUserToDatabase = async (payload: CognitoIdTokenPayload, repositoryProvider: LambdaRepositoryProvider) => {
    const deaUser = await getDeaUserFromToken(payload);

    const deaUserResult = await UserService.createUser(deaUser, repositoryProvider);
    if (!deaUserResult) {
        throw new ValidationError('Unable to add newly federated user to the database');
    }
}

// Session Management Checks Helper Functions

// TODO: Add these