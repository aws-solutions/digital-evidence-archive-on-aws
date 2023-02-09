/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaUser } from '../../models/user';
import { defaultProvider } from '../../persistence/schema/entities';
import * as UserPersistence from '../../persistence/user';

export const createUser = async (
  user: DeaUser,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaUser> => {
  return await UserPersistence.createUser(user, repositoryProvider);
};

export const getUser = async (
  userUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaUser | undefined> => {
  return await UserPersistence.getUser(userUlid, repositoryProvider);
};

export const getUserUsingTokenId = async (
  tokenId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaUser | undefined> => {
  return await UserPersistence.getUserByTokenId(tokenId, repositoryProvider);
};

export const getUsers = async (
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<Paged<DeaUser>> => {
  return UserPersistence.listUsers(limit, nextToken, repositoryProvider);
};
