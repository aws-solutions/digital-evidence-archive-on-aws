/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { logger } from '../../logger';
import { DeaCase, DeaCaseInput } from '../../models/case';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { caseFromEntity } from '../../models/projections';
import { DeaUser } from '../../models/user';
import * as CasePersistence from '../../persistence/case';
import * as CaseFilePersistence from '../../persistence/case-file';
import * as CaseUserPersistence from '../../persistence/case-user';
import { isDefined } from '../../persistence/persistence-helpers';
import { CaseType, ModelRepositoryProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, startDeleteCaseFilesS3BatchJob } from '../../storage/datasets';
import * as CaseUserService from './case-user-service';

export const createCases = async (
  deaCase: DeaCaseInput,
  owner: DeaUser,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCase> => {
  const createdCase = await CasePersistence.createCase(deaCase, owner, repositoryProvider);

  return createdCase;
};

export const listAllCases = async (
  limit = 30,
  nextToken: object | undefined,
  repositoryProvider: ModelRepositoryProvider
): Promise<Paged<DeaCase>> => {
  return CasePersistence.listCases(limit, nextToken, repositoryProvider);
};

export const listCasesForUser = async (
  userUlid: string,
  limit = 30,
  nextToken: object | undefined,
  repositoryProvider: ModelRepositoryProvider
): Promise<Paged<DeaCase>> => {
  // Get all memberships for the user
  const caseMemberships = await CaseUserPersistence.listCaseUsersByUser(
    userUlid,
    limit,
    nextToken,
    repositoryProvider
  );

  // Build a batch object of get requests for the case in each membership
  let caseEntities: CaseType[] = [];
  let batch = {};
  let batchSize = 0;
  for (const caseMembership of caseMemberships) {
    await CasePersistence.getCase(caseMembership.caseUlid, batch, repositoryProvider);
    ++batchSize;
    if (batchSize === 25) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cases = (await repositoryProvider.table.batchGet(batch, {
        parse: true,
        hidden: false,
        consistent: true,
      })) as CaseType[];
      caseEntities = caseEntities.concat(cases);
      batch = {};
      batchSize = 0;
    }
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const finalCases = (await repositoryProvider.table.batchGet(batch, {
    parse: true,
    hidden: false,
    consistent: true,
  })) as CaseType[];
  caseEntities = caseEntities.concat(finalCases);

  const cases: Paged<DeaCase> = caseEntities
    .map((caseEntity) => caseFromEntity(caseEntity))
    .filter(isDefined);
  cases.count = caseMemberships.count;
  cases.next = caseMemberships.next;

  return cases;
};

export const getCase = async (
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCase | undefined> => {
  return await CasePersistence.getCase(caseUlid, undefined, repositoryProvider);
};

export const updateCases = async (
  deaCase: DeaCase,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCase> => {
  return await CasePersistence.updateCase(deaCase, repositoryProvider);
};

export const updateCaseStatus = async (
  deaCase: DeaCase,
  newStatus: CaseStatus,
  deleteFiles: boolean,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider: DatasetsProvider
): Promise<DeaCase> => {
  const filesStatus = deleteFiles ? CaseFileStatus.DELETE_FAILED : CaseFileStatus.ACTIVE;
  const updatedCase = await CasePersistence.updateCaseStatus(
    deaCase,
    newStatus,
    filesStatus,
    repositoryProvider
  );

  if (!deleteFiles) {
    return updatedCase;
  }

  try {
    const s3FileKeys = await CaseFilePersistence.getAllCaseFileS3Keys(deaCase.ulid, repositoryProvider);
    console.log(s3FileKeys);
    const s3BatchJobId = await startDeleteCaseFilesS3BatchJob(deaCase.ulid, s3FileKeys, datasetsProvider);
    return CasePersistence.updateCaseStatus(
      deaCase,
      newStatus,
      CaseFileStatus.DELETING,
      repositoryProvider,
      s3BatchJobId
    );
  } catch (e) {
    logger.error('Failed to start delete case files s3 batch job.');
  }

  return updatedCase;
};

export const deleteCase = async (
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await CasePersistence.deleteCase(caseUlid, repositoryProvider);
  await CaseUserService.deleteCaseUsersForCase(caseUlid, repositoryProvider);
};
