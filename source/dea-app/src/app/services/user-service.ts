/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaUser, DeaUserInput } from '../../models/user';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import * as UserPersistence from '../../persistence/user';

export const createUser = async (
  user: DeaUserInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaUser> => {
  return await UserPersistence.createUser(user, repositoryProvider);
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
