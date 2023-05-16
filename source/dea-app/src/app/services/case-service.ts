/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { OneTableError, Paged } from 'dynamodb-onetable';
import { logger } from '../../logger';
import { DeaCase, DeaCaseInput, MyCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { myCaseFromEntityAndActionsMap } from '../../models/projections';
import { DeaUser } from '../../models/user';
import * as CasePersistence from '../../persistence/case';
import * as CaseFilePersistence from '../../persistence/case-file';
import * as CaseUserPersistence from '../../persistence/case-user';
import { createJob } from '../../persistence/job';
import { isDefined } from '../../persistence/persistence-helpers';
import { CaseType, ModelRepositoryProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, startDeleteCaseFilesS3BatchJob } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseUserService from './case-user-service';

export const createCases = async (
  deaCase: DeaCaseInput,
  owner: DeaUser,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCase> => {
  try {
    return await CasePersistence.createCase(deaCase, owner, repositoryProvider);
  } catch (error) {
    // Check if OneTableError happened because the case name is already in use.
    if ('code' in error) {
      const oneTableError: OneTableError = error;
      const conditionalcheckfailed = oneTableError.context?.err?.CancellationReasons.find(
        (reason: { Code: string }) => reason.Code === 'ConditionalCheckFailed'
      );
      if (oneTableError.code === 'TransactionCanceledException' && conditionalcheckfailed) {
        throw new ValidationError(`Case name is already in use`);
      }
    }
    throw error;
  }
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
): Promise<Paged<MyCase>> => {
  // Get all memberships for the user
  const caseMemberships = await CaseUserPersistence.listCaseUsersByUser(
    userUlid,
    limit,
    nextToken,
    repositoryProvider
  );

  const caseActionsMap = new Map<string, CaseAction[]>();

  // Build a batch object of get requests for the case in each membership
  let caseEntities: CaseType[] = [];
  let batch = {};
  let batchSize = 0;
  for (const caseMembership of caseMemberships) {
    caseActionsMap.set(caseMembership.caseUlid, caseMembership.actions);
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

  const cases: Paged<MyCase> = caseEntities
    .map((caseEntity) => myCaseFromEntityAndActionsMap(caseEntity, caseActionsMap))
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
    const s3Objects = await CaseFilePersistence.getAllCaseFileS3Objects(deaCase.ulid, repositoryProvider);
    const jobId = await startDeleteCaseFilesS3BatchJob(deaCase.ulid, s3Objects, datasetsProvider);
    if (!jobId) {
      // no files to delete
      return CasePersistence.updateCaseStatus(
        updatedCase,
        newStatus,
        CaseFileStatus.DELETED,
        repositoryProvider
      );
    }

    await createJob({ caseUlid: deaCase.ulid, jobId }, repositoryProvider);
    return CasePersistence.updateCaseStatus(
      updatedCase,
      newStatus,
      CaseFileStatus.DELETING,
      repositoryProvider,
      jobId
    );
  } catch (e) {
    logger.error('Failed to start delete case files s3 batch job.', e);
    throw new Error('Failed to delete files. Please retry.');
  }
};

export const deleteCase = async (
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await CasePersistence.deleteCase(caseUlid, repositoryProvider);
  await CaseUserService.deleteCaseUsersForCase(caseUlid, repositoryProvider);
};
