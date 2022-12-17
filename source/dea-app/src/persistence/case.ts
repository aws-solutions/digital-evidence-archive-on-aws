/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCase } from '../models/case';
import { caseFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { CaseModel, CaseModelRepositoryProvider } from './schema/entities';

export const getCase = async (
  ulid: string,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  const caseEntity = await repositoryProvider.CaseModel.get({
    PK: `CASE#${ulid}#`,
    SK: `CASE#`,
  });

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
  //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
  cases.prev = undefined;

  return cases;
};

export const createCase = async (
  deaCase: DeaCase,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  return _upsertCase(deaCase, false, repositoryProvider);
};

export const updateCase = async (
  deaCase: DeaCase,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  return _upsertCase(deaCase, true, repositoryProvider);
};

const _upsertCase = async (
  deaCase: DeaCase,
  update?: boolean,
  repositoryProvider: CaseModelRepositoryProvider = {
    CaseModel: CaseModel,
  }
): Promise<DeaCase | undefined> => {
  const newEntity = await repositoryProvider.CaseModel.upsert(
    {
      ...deaCase,
      lowerCaseName: deaCase.name.toLowerCase(),
    },
    { exists: update }
  );

  return caseFromEntity(newEntity);
};
