/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { logger } from '../logger';
import { DeaCase } from '../models/case';
import { caseFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { CaseModel, CaseModelRepositoryProvider } from './schema/entities';

export const getCase = async (
  ulid: string,
  batch: object | undefined = undefined,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  const caseEntity = await repositoryProvider.CaseModel.get({
    PK: `CASE#${ulid}#`,
    SK: `CASE#`,
  }, {batch});

  return caseFromEntity(caseEntity);
};

export const listCases = async (
  limit = 30,
  nextToken?: object,
  repositoryProvider: CaseModelRepositoryProvider = { CaseModel: CaseModel }
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
  deaCase: DeaCase,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  const newEntity = await repositoryProvider.CaseModel.create({
    ...deaCase,
    lowerCaseName: deaCase.name.toLowerCase(),
  });
  const newCase = caseFromEntity(newEntity);
  if (!newCase) {
    logger.error('Case creation failed', { deaCase: JSON.stringify(deaCase) });
    throw new Error('Case creation failed');
  }
  return newCase;
};

export const updateCase = async (
  deaCase: DeaCase,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  const newCase = await repositoryProvider.CaseModel.update({
    ...deaCase,
    lowerCaseName: deaCase.name.toLowerCase(),
  }, {
    // Normally, update() will return the updated item automatically, 
    //   however, it the item has unique attributes,
    //   a transaction is used which does not return the updated item.
    //   In this case, use {return: 'get'} to retrieve and return the updated item.
    return: 'get'
  });
  return caseFromEntity(newCase);
};

export const deleteCase = async (
  caseUlid: string,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<void> => {
  await repositoryProvider.CaseModel.remove({
    PK: `CASE#${caseUlid}#`,
    SK: `CASE#`,
  });
};
