/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseFromEntity } from '../../models/projections';
import { DeaUser } from '../../models/user';
import * as CasePersistence from '../../persistence/case';
import * as CaseUserPersistence from '../../persistence/case-user';
import { isDefined } from '../../persistence/persistence-helpers';
import { CaseType, defaultProvider } from '../../persistence/schema/entities';
import * as CaseUserService from './case-user-service';

export const createCases = async (
  deaCase: DeaCase,
  owner: DeaUser,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCase> => {
  const currentCase: DeaCase = {
    ...deaCase,
    status: CaseStatus.ACTIVE,
    objectCount: 0,
  };

  const createdCase = await CasePersistence.createCase(currentCase, owner, repositoryProvider);

  return createdCase;
};

export const listAllCases = async (
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<Paged<DeaCase>> => {
  return CasePersistence.listCases(limit, nextToken, repositoryProvider);
};

export const listCasesForUser = async (
  userUlid: string,
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<Paged<DeaCase>> => {
  // Get all memberships for the user
  const caseMemberships = await CaseUserPersistence.listCaseUsersByUser(
    userUlid,
    limit,
    nextToken,
    repositoryProvider
  );

  // Build a batch object of get requests for the case in each membership
  const batch = {};
  for (const caseMembership of caseMemberships) {
    await CasePersistence.getCase(caseMembership.caseUlid, batch, repositoryProvider);
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const caseEntities = (await repositoryProvider.table.batchGet(batch, {
    parse: true,
    hidden: false,
    consistent: true,
  })) as CaseType[];

  const cases: Paged<DeaCase> = caseEntities
    .map((caseEntity) => caseFromEntity(caseEntity))
    .filter(isDefined);
  cases.count = caseMemberships.count;
  cases.next = caseMemberships.next;

  return cases;
};

export const getCase = async (
  caseUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCase | undefined> => {
  return await CasePersistence.getCase(caseUlid, undefined, repositoryProvider);
};

export const updateCases = async (
  deaCase: DeaCase,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCase> => {
  return await CasePersistence.updateCase(deaCase, repositoryProvider);
};

export const deleteCase = async (
  caseUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<void> => {
  await CasePersistence.deleteCase(caseUlid, repositoryProvider);
  await CaseUserService.deleteCaseUsersForCase(caseUlid, repositoryProvider);
};
