/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { userFromEntity } from '../models/projections';
import { DeaUser, DeaUserInput } from '../models/user';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider, UserModel, UserModelRepositoryProvider, UserType } from './schema/entities';

export const getUsers = async (
  ulids: string[],
  repositoryProvider: ModelRepositoryProvider
): Promise<Map<string, DeaUser>> => {
  // Build a batch object of get requests for the case in each membership
  let userEntities: UserType[] = [];
  let batch = {};
  let batchSize = 0;
  for (const userUlid of ulids) {
    await getUser(userUlid, repositoryProvider, batch);
    ++batchSize;
    if (batchSize === 25) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cases = (await repositoryProvider.table.batchGet(batch, {
        parse: true,
        hidden: false,
        consistent: true,
      })) as UserType[];
      userEntities = userEntities.concat(cases);
      batch = {};
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cases = (await repositoryProvider.table.batchGet(batch, {
      parse: true,
      hidden: false,
      consistent: true,
    })) as UserType[];
    userEntities = userEntities.concat(cases);
  }

  return new Map(userEntities.map((entity) => [entity.ulid, userFromEntity(entity)]));
};

export const getUser = async (
  ulid: string,
  repositoryProvider: UserModelRepositoryProvider,
  batch?: object
): Promise<DeaUser | undefined> => {
  const userEntity = await repositoryProvider.UserModel.get(
    {
      PK: `USER#${ulid}#`,
      SK: `USER#`,
    },
    {
      batch,
    }
  );

  if (!userEntity) {
    return undefined;
  }

  return userFromEntity(userEntity);
};

export const getUserByTokenId = async (
  tokenId: string,
  repositoryProvider: UserModelRepositoryProvider = {
    UserModel: UserModel,
  }
): Promise<DeaUser | undefined> => {
  const userEntity = await repositoryProvider.UserModel.get(
    {
      GSI2PK: `USER#${tokenId}#`,
      GSI2SK: `USER#`,
    },
    {
      index: 'GSI2',
    }
  );

  return userEntity;
};

export const listUsers = async (
  nameBeginsWith: string | undefined,
  repositoryProvider: UserModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaUser>> => {
  const namePrefix = nameBeginsWith?.toLowerCase() ?? '';
  const caseEntities = await repositoryProvider.UserModel.find(
    {
      GSI1PK: 'USER#',
      GSI1SK: {
        begins_with: `USER#${namePrefix}`,
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const users: Paged<DeaUser> = caseEntities.map((entity) => userFromEntity(entity)).filter(isDefined);
  users.count = caseEntities.count;
  users.next = caseEntities.next;
  //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
  users.prev = undefined;

  return users;
};

export const createUser = async (
  deaUser: DeaUserInput,
  repositoryProvider: UserModelRepositoryProvider
): Promise<DeaUser> => {
  const newEntity = await repositoryProvider.UserModel.create({
    ...deaUser,
    lowerFirstName: deaUser.firstName.toLowerCase(),
    lowerLastName: deaUser.lastName.toLowerCase(),
  });

  return userFromEntity(newEntity);
};

export const updateUser = async (
  deaUser: DeaUser,
  repositoryProvider: UserModelRepositoryProvider
): Promise<DeaUser> => {
  const newEntity = await repositoryProvider.UserModel.update(
    {
      ...deaUser,
      lowerFirstName: deaUser.firstName.toLowerCase(),
      lowerLastName: deaUser.lastName.toLowerCase(),
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );

  return userFromEntity(newEntity);
};

export const deleteUser = async (
  ulid: string,
  repositoryProvider: UserModelRepositoryProvider
): Promise<void> => {
  await repositoryProvider.UserModel.remove({
    PK: `USER#${ulid}#`,
    SK: `USER#`,
  });
};
