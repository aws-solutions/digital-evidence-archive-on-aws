/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCase, DeaCaseInput } from '../../models/case';
import { OWNER_ACTIONS } from '../../models/case-action';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { DeaUser } from '../../models/user';
import { createCase, deleteCase, getCase, listCases, updateCase } from '../../persistence/case';
import { getCaseUser } from '../../persistence/case-user';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { getTestRepositoryProvider } from './local-db-table';

describe('case persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let caseOwner: DeaUser;
  let testCase: DeaCase;
  let caseUlid: string;
  let listCase1: DeaCase;
  let listCase1Ulid: string;
  let listCase1Created: Date;
  let listCase1Updated: Date;
  let listCase2: DeaCase;
  let listCase2Ulid: string;
  let listCase2Created: Date;
  let listCase2Updated: Date;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('caseTestsTable');
    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
    testCase =
      (await createCase({ name: 'TheCase', description: 'TheDescription' }, caseOwner, repositoryProvider)) ??
      fail();
    caseUlid = testCase.ulid ?? fail();

    //list endpoints
    await createListData();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should add the creator as a case user with all permissions', async () => {
    const caseUser = await getCaseUser(
      {
        caseUlid: testCase.ulid ?? fail(),
        userUlid: caseOwner.ulid ?? fail(),
      },
      repositoryProvider
    );

    expect(caseUser).toBeDefined();
    expect(caseUser?.actions).toEqual(OWNER_ACTIONS);
    expect(caseUser?.caseName).toStrictEqual(testCase.name);
    expect(caseUser?.userFirstName).toStrictEqual(caseOwner.firstName);
    expect(caseUser?.userLastName).toStrictEqual(caseOwner.lastName);
  });

  it('should return undefined if a case is not found', async () => {
    const currentCase = await getCase('bogus', undefined, repositoryProvider);

    expect(currentCase).toBeUndefined();
  });

  it('should get a case by id', async () => {
    const currentCase = await getCase(caseUlid, undefined, repositoryProvider);

    expect(currentCase).toEqual(testCase);
  });

  it('should list the first page of cases', async () => {
    const expectedCases: Paged<DeaCase> = [
      {
        ulid: listCase1Ulid,
        name: listCase1.name,
        status: CaseStatus.ACTIVE,
        filesStatus: CaseFileStatus.ACTIVE,
        objectCount: 0,
        created: listCase1Created,
        updated: listCase1Updated,
      },
      {
        ulid: listCase2Ulid,
        name: listCase2.name,
        status: CaseStatus.ACTIVE,
        filesStatus: CaseFileStatus.ACTIVE,
        objectCount: 0,
        created: listCase2Created,
        updated: listCase2Updated,
      },
      {
        ulid: testCase.ulid,
        name: testCase.name,
        status: CaseStatus.ACTIVE,
        filesStatus: CaseFileStatus.ACTIVE,
        description: 'TheDescription',
        objectCount: 0,
        created: testCase.created,
        updated: testCase.updated,
      },
    ];
    expectedCases.count = 3;
    expectedCases.next = undefined;
    expectedCases.prev = undefined;

    const actual = await listCases(undefined, undefined, repositoryProvider);

    expect(actual.values).toEqual(expectedCases.values);
  });

  it('should throw an exception when invalid characters are used', async () => {
    const currentTestCase: DeaCaseInput = {
      name: '<case></case>',
      description: 'In a PD far far away',
    };

    await expect(createCase(currentTestCase, caseOwner, repositoryProvider)).rejects.toThrow(
      'Validation Error in "Case" for "name, lowerCaseName"'
    );
  });

  it('should create a case, get and update it', async () => {
    const currentTestCase: DeaCaseInput = {
      name: 'Case Wars',
      description: 'In a PD far far away',
    };

    const createdCase = await createCase(currentTestCase, caseOwner, repositoryProvider);

    const readCase = await getCase(createdCase?.ulid ?? 'bogus', undefined, repositoryProvider);

    const caseCheck: DeaCase = {
      ulid: createdCase?.ulid,
      created: createdCase?.created,
      updated: createdCase?.updated,
      status: CaseStatus.ACTIVE,
      filesStatus: CaseFileStatus.ACTIVE,
      ...currentTestCase,
    };
    expect(readCase).toEqual(caseCheck);

    // Update case
    const updateTestCase: DeaCase = {
      ulid: createdCase?.ulid,
      name: 'Case Wars7',
      status: CaseStatus.ACTIVE,
      filesStatus: CaseFileStatus.ACTIVE,
      description: 'The first 6 were better',
    };

    const updatedCase = await updateCase(updateTestCase, repositoryProvider);

    const updateCheck: DeaCase = {
      ...updateTestCase,
      objectCount: updatedCase?.objectCount,
      created: createdCase?.created,
      updated: updatedCase?.updated,
    };

    expect(updatedCase).toEqual(updateCheck);
  });

  async function createListData(): Promise<void> {
    listCase1 = (await createCase({ name: '2001: A Case Odyssey' }, caseOwner, repositoryProvider)) ?? fail();
    listCase1Ulid = listCase1.ulid ?? fail();
    listCase1Created = listCase1.created ?? fail();
    listCase1Updated = listCase1.updated ?? fail();
    listCase2 =
      (await createCase({ name: 'Between a rock and a hard case' }, caseOwner, repositoryProvider)) ?? fail();
    listCase2Ulid = listCase2.ulid ?? fail();
    listCase2Created = listCase2.created ?? fail();
    listCase2Updated = listCase2.updated ?? fail();
  }

  it('should create a case, get and delete it', async () => {
    const currentTestCase: DeaCaseInput = {
      name: 'CaseMcCaseface',
      description: 'some days some nights',
    };

    const createdCase = await createCase(currentTestCase, caseOwner, repositoryProvider);

    const readCase = await getCase(createdCase?.ulid ?? fail(), undefined, repositoryProvider);

    const caseCheck: DeaCase = {
      ulid: createdCase?.ulid,
      created: createdCase?.created,
      updated: createdCase?.updated,
      status: CaseStatus.ACTIVE,
      filesStatus: CaseFileStatus.ACTIVE,
      ...currentTestCase,
    };
    expect(readCase).toEqual(caseCheck);

    // Delete
    await deleteCase(createdCase?.ulid ?? fail(), repositoryProvider);

    const nullCase = await getCase(createdCase?.ulid ?? fail(), undefined, repositoryProvider);

    expect(nullCase).toBeFalsy();
  });
});
