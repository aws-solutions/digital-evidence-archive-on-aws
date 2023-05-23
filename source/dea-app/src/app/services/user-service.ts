/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaUser, DeaUserInput } from '../../models/user';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import * as UserPersistence from '../../persistence/user';
import { NotFoundError } from '../exceptions/not-found-exception';
import { retry } from './service-helpers';

export const createUser = async (
  user: DeaUserInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaUser> => {
  try {
    return await UserPersistence.createUser(user, repositoryProvider);
  } catch (error) {
    // Its possible for the frontend to make 2 calls simulataneously after first time user login
    // causing a race condition where both calls try to find the the user
    // in the db, see it doesn't exist, and try to create it
    // and one would fail due to uniqueness constraint.
    // Therefore, try to see if user exists, and return that
    const maybeUser = await retry<DeaUser>(async () => {
      const maybeUser = await getUserUsingTokenId(user.tokenId, repositoryProvider);
      if (!maybeUser) {
        throw new Error('Could not find user...');
      }
      return maybeUser;
    });
    if (!maybeUser) {
      throw new Error(error);
    }

    return maybeUser;
  }
};

export const getUser = async (
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaUser | undefined> => {
  return await UserPersistence.getUser(userUlid, repositoryProvider);
};

export const getUserUsingTokenId = async (
  tokenId: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaUser | undefined> => {
  return await UserPersistence.getUserByTokenId(tokenId, repositoryProvider);
};

export const getUsers = async (
  limit = 30,
  nextToken: object | undefined,
  nameBeginsWith: string | undefined,
  repositoryProvider: ModelRepositoryProvider
): Promise<Paged<DeaUser>> => {
  return UserPersistence.listUsers(limit, nextToken, nameBeginsWith, repositoryProvider);
};

export const validateUser = async (userUlid: string, repositoryProvider: ModelRepositoryProvider) => {
  const maybeUser = await UserPersistence.getUser(userUlid, repositoryProvider);
  if (!maybeUser) {
    throw new NotFoundError('Could not find user');
  }
};
