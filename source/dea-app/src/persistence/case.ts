/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCase, DeaCaseInput } from '../models/case';
import { OWNER_ACTIONS } from '../models/case-action';
import { CaseFileStatus } from '../models/case-file-status';
import { CaseStatus } from '../models/case-status';
import { caseFromEntity } from '../models/projections';
import { DeaUser } from '../models/user';
import { isDefined } from './persistence-helpers';
import { CaseModelRepositoryProvider, ModelRepositoryProvider } from './schema/entities';

export const getCase = async (
  ulid: string,
  batch: object | undefined = undefined,
  repositoryProvider: CaseModelRepositoryProvider
): Promise<DeaCase | undefined> => {
  const caseEntity = await repositoryProvider.CaseModel.get(
    {
      PK: `CASE#${ulid}#`,
      SK: `CASE#`,
    },
    { batch }
  );

  if (!caseEntity) {
    return caseEntity;
  }

  return caseFromEntity(caseEntity);
};

export const listCases = async (
  limit = 30,
  nextToken: object | undefined,
  repositoryProvider: CaseModelRepositoryProvider
): Promise<Paged<DeaCase>> => {
  const caseEntities = await repositoryProvider.CaseModel.find(
    {
      GSI1PK: 'CASE#',
      GSI1SK: {
        begins_with: 'CASE#',
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const cases: Paged<DeaCase> = caseEntities.map((entity) => caseFromEntity(entity)).filter(isDefined);
  cases.count = caseEntities.count;
  cases.next = caseEntities.next;

  return cases;
};

export const createCase = async (
  deaCase: DeaCaseInput,
  owner: DeaUser,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCase> => {
  const transaction = {};
  const caseEntity = await repositoryProvider.CaseModel.create(
    {
      ...deaCase,
      status: CaseStatus.ACTIVE,
      lowerCaseName: deaCase.name.toLowerCase(),
      filesStatus: CaseFileStatus.ACTIVE,
    },
    { transaction }
  );
  await repositoryProvider.CaseUserModel.create(
    {
      userUlid: owner.ulid,
      caseUlid: caseEntity.ulid,
      actions: OWNER_ACTIONS,
      caseName: caseEntity.name,
      userFirstName: owner.firstName,
      userLastName: owner.lastName,
      userFirstNameLower: owner.firstName.toLowerCase(),
      userLastNameLower: owner.lastName.toLowerCase(),
      lowerCaseName: caseEntity.lowerCaseName,
    },
    { transaction }
  );
  await repositoryProvider.table.transact('write', transaction);

  return caseFromEntity(caseEntity);
};

export const updateCaseStatus = async (
  deaCase: DeaCase,
  status: CaseStatus,
  filesStatus: CaseFileStatus,
  repositoryProvider: CaseModelRepositoryProvider,
  s3BatchJobId?: string
): Promise<DeaCase> => {
  const updatedCase = await repositoryProvider.CaseModel.update(
    {
      ...deaCase,
      status,
      filesStatus,
      s3BatchJobId,
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );
  return caseFromEntity(updatedCase);
};

export const updateCasePostJobCompletion = async (
  deaCase: DeaCase,
  filesStatus: CaseFileStatus,
  repositoryProvider: CaseModelRepositoryProvider
): Promise<DeaCase> => {
  const updatedCase = await repositoryProvider.CaseModel.update(
    {
      ...deaCase,
      filesStatus,
      s3BatchJobId: null, // remove jobId since the job is now complete
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );
  return caseFromEntity(updatedCase);
};

export const updateCase = async (
  deaCase: DeaCase,
  repositoryProvider: CaseModelRepositoryProvider
): Promise<DeaCase> => {
  const newCase = await repositoryProvider.CaseModel.update(
    {
      ...deaCase,
      lowerCaseName: deaCase.name.toLowerCase(),
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );
  return caseFromEntity(newCase);
};

export const deleteCase = async (
  caseUlid: string,
  repositoryProvider: CaseModelRepositoryProvider
): Promise<void> => {
  await repositoryProvider.CaseModel.remove({
    PK: `CASE#${caseUlid}#`,
    SK: `CASE#`,
  });
};
