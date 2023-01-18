/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import * as CasePersistence from '../../persistence/case';
import * as CaseUserPersistence from '../../persistence/case-user';
import { deaTable } from '../../persistence/schema/dea-table';

export const createCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  const currentCase: DeaCase = {
    ...deaCase,
    status: CaseStatus.ACTIVE,
    objectCount: 0,
  };

  // TODO: create initial User/Owner on CreateCase

  return await CasePersistence.createCase(currentCase);
};

export const listAllCases = async (
  limit = 30,
  nextToken?: object,
): Promise<Paged<DeaCase>> => {
  return CasePersistence.listCases(limit, nextToken);
}

export const listCasesForUser = async (
  userUlid: string,
  limit = 30,
  nextToken?: object,
): Promise<Paged<DeaCase>> => {
  // Get all memberships for the user
  const caseMemberships = await CaseUserPersistence.listCaseUsersByUser(userUlid, limit, nextToken);

  // Build a batch object of get requests for the case in each membership
  const batch = {};
  for (const caseMembership of caseMemberships) {
    CasePersistence.getCase(caseMembership.caseUlid, {batch});
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cases = (await deaTable.batchGet(batch)) as DeaCase[];

  return {
    ...cases,
    count: caseMemberships.count,
    next: caseMemberships.next,
  }
}

export const getCase = async (caseUlid: string): Promise<DeaCase | undefined> => {
  return await CasePersistence.getCase(caseUlid);
};

export const updateCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  return await CasePersistence.updateCase(deaCase);
};

export const deleteCase = async (caseUlid: string): Promise<void> => {
  return await CasePersistence.deleteCase(caseUlid);
};
