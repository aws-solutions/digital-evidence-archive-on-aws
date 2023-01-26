/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { CaseUser } from '../models/case-user';
import { caseUserFromEntity } from '../models/projections';
import { CaseUserModel, CaseUserModelRepositoryProvider } from './schema/entities';

export const getCaseUser = async (
  caseUserIds: {
    readonly caseUlid: string;
    readonly userUlid: string;
  },
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = {
    CaseUserModel: CaseUserModel,
  }
): Promise<CaseUser | undefined> => {
  const caseUserEntity = await repositoryProvider.CaseUserModel.get({
    PK: `USER#${caseUserIds.userUlid}#`,
    SK: `CASE#${caseUserIds.caseUlid}#`,
  });

  if (!caseUserEntity) {
    return undefined;
  }

  return caseUserFromEntity(caseUserEntity);
};

export const listCaseUsersByCase = async (
  caseUlid: string,
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = { CaseUserModel: CaseUserModel }
): Promise<Paged<CaseUser>> => {
  const caseEntities = await repositoryProvider.CaseUserModel.find(
    {
      GSI1PK: `CASE#${caseUlid}#`,
      GSI1SK: {
        begins_with: 'USER#',
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const caseUsers: Paged<CaseUser> = caseEntities.map((entity) => caseUserFromEntity(entity));
  caseUsers.count = caseEntities.count;
  caseUsers.next = caseEntities.next;

  return caseUsers;
};

export const listCaseUsersByUser = async (
  userUlid: string,
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = { CaseUserModel: CaseUserModel }
): Promise<Paged<CaseUser>> => {
  const caseEntities = await repositoryProvider.CaseUserModel.find(
    {
      GSI2PK: `USER#${userUlid}#`,
      GSI2SK: {
        begins_with: 'CASE#',
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI2',
    }
  );

  const caseUsers: Paged<CaseUser> = caseEntities.map((entity) => caseUserFromEntity(entity));
  caseUsers.count = caseEntities.count;
  caseUsers.next = caseEntities.next;

  return caseUsers;
};

export const createCaseUser = async (
  caseUser: CaseUser,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = {
    CaseUserModel: CaseUserModel,
  }
): Promise<CaseUser> => {
  const newEntity = await repositoryProvider.CaseUserModel.create({
    ...caseUser,
    userFirstNameLower: caseUser.userFirstName.toLowerCase(),
    userLastNameLower: caseUser.userLastName.toLowerCase(),
    lowerCaseName: caseUser.caseName.toLowerCase(),
  });

  return caseUserFromEntity(newEntity);
};

export const updateCaseUser = async (
  caseUser: CaseUser,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = {
    CaseUserModel: CaseUserModel,
  }
): Promise<CaseUser> => {
  const newEntity = await repositoryProvider.CaseUserModel.update({
    ...caseUser,
    userFirstNameLower: caseUser.userFirstName.toLowerCase(),
    userLastNameLower: caseUser.userLastName.toLowerCase(),
    lowerCaseName: caseUser.caseName.toLowerCase(),
  });

  return caseUserFromEntity(newEntity);
};

export const deleteCaseUser = async (
  caseUserIds: {
    readonly caseUlid: string;
    readonly userUlid: string;
  },
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseUserModelRepositoryProvider = {
    CaseUserModel: CaseUserModel,
  }
): Promise<void> => {
  await repositoryProvider.CaseUserModel.remove({
    PK: `USER#${caseUserIds.userUlid}#`,
    SK: `CASE#${caseUserIds.caseUlid}#`,
  });
};
