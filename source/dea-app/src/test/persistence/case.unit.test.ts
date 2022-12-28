/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged, Table } from 'dynamodb-onetable';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { createCase, getCase, listCases, updateCase } from '../../persistence/case';
import { CaseModelRepositoryProvider } from '../../persistence/schema/entities';
import { initLocalDb } from './local-db-table';

describe('case persistence', () => {
  let testTable: Table;
  let caseModelProvider: CaseModelRepositoryProvider;
  let testCase: DeaCase;
  let caseUlid: string;
  let listCase1: DeaCase;
  let listCase1Ulid: string;
  let listCase2: DeaCase;
  let listCase2Ulid: string;

  beforeAll(async () => {
    testTable = await initLocalDb('caseTestsTable');
    caseModelProvider = { CaseModel: testTable.getModel('Case') };
    testCase =
      (await createCase(
        { name: 'TheCase', status: CaseStatus.ACTIVE, description: 'TheDescription' },
        caseModelProvider
      )) ?? fail();
    caseUlid = testCase.ulid ?? fail();

    //list endpoints
    await createListData();
  });

  afterAll(async () => {
    await testTable.deleteTable('DeleteTableForever');
  });

  it('should return undefined if a case is not found', async () => {
    const currentCase = await getCase('bogus', caseModelProvider);

    expect(currentCase).toBeUndefined();
  });

  it('should get a case by id', async () => {
    const currentCase = await getCase(caseUlid, caseModelProvider);

    expect(currentCase).toEqual(testCase);
  });

  it('should list the first page of cases', async () => {
    const expectedCases: Paged<DeaCase> = [
      {
        ulid: listCase1Ulid,
        name: listCase1.name,
        status: CaseStatus.ACTIVE,
        objectCount: 0,
      },
      {
        ulid: listCase2Ulid,
        name: listCase2.name,
        status: CaseStatus.ACTIVE,
        objectCount: 0,
      },
      {
        ulid: testCase.ulid,
        name: testCase.name,
        status: CaseStatus.ACTIVE,
        description: 'TheDescription',
        objectCount: 0,
      },
    ];
    expectedCases.count = 3;
    expectedCases.next = undefined;
    expectedCases.prev = undefined;

    const actual = await listCases(20, undefined, caseModelProvider);

    expect(actual.values).toEqual(expectedCases.values);
  });

  it('should create a case, get and update it', async () => {
    const currentTestCase: DeaCase = {
      name: 'Case Wars',
      status: CaseStatus.ACTIVE,
      description: 'In a PD far far away',
      objectCount: 0,
    };

    const createdCase = await createCase(currentTestCase, caseModelProvider);

    const readCase = await getCase(createdCase?.ulid ?? 'bogus', caseModelProvider);

    const caseCheck: DeaCase = {
      ulid: createdCase?.ulid,
      ...currentTestCase,
    };
    expect(readCase).toEqual(caseCheck);

    // Update case
    const updateTestCase: DeaCase = {
      ulid: createdCase?.ulid,
      name: 'Case Wars7',
      status: CaseStatus.ACTIVE,
      description: 'The first 6 were better',
    };

    const updatedCase = await updateCase(updateTestCase, caseModelProvider);

    const updateCheck: DeaCase = {
      ...updateTestCase,
      objectCount: updatedCase?.objectCount,
    };

    expect(updatedCase).toEqual(updateCheck);
  });

  async function createListData(): Promise<void> {
    listCase1 =
      (await createCase({ name: '2001: A Case Odyssey', status: CaseStatus.ACTIVE }, caseModelProvider)) ??
      fail();
    listCase1Ulid = listCase1.ulid ?? fail();
    listCase2 =
      (await createCase(
        { name: 'Between a rock and a hard case', status: CaseStatus.ACTIVE },
        caseModelProvider
      )) ?? fail();
    listCase2Ulid = listCase2.ulid ?? fail();
  }
});
