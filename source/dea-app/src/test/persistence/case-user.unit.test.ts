/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged, Table } from 'dynamodb-onetable';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { CaseUser } from '../../models/case-user';
import { DeaUser } from '../../models/user';
import { createCase } from '../../persistence/case';
import {
  createCaseUser,
  deleteCaseUser,
  getCaseUser,
  listCaseUsersByCase,
  listCaseUsersByUser,
  updateCaseUser,
} from '../../persistence/case-user';
import {
  CaseModelRepositoryProvider,
  CaseUserModelRepositoryProvider,
  UserModelRepositoryProvider,
} from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { initLocalDb } from './local-db-table';

describe('caseUser persistence', () => {
  let testTable: Table;
  let caseUserModelProvider: CaseUserModelRepositoryProvider;
  let userModelProvider: UserModelRepositoryProvider;
  let caseModelProvider: CaseModelRepositoryProvider;
  let testUser: DeaUser;
  let testCase: DeaCase;
  let userUlid: string;
  let caseUlid: string;
  let listUser1: DeaUser;
  let listUser1Ulid: string;
  let listUser2: DeaUser;
  let listUser2Ulid: string;
  let listCase1: DeaCase;
  let listCase1Ulid: string;
  let listCase2: DeaCase;
  let listCase2Ulid: string;
  let listCaseUser1_1: CaseUser;
  let listCaseUser1_2: CaseUser;
  let listCaseUser2_1: CaseUser;

  beforeAll(async () => {
    testTable = await initLocalDb('caseUserTestsTable');
    caseUserModelProvider = { CaseUserModel: testTable.getModel('CaseUser') };
    userModelProvider = { UserModel: testTable.getModel('User') };
    caseModelProvider = { CaseModel: testTable.getModel('Case') };
    testUser = (await createUser({ firstName: 'Case', lastName: 'Man' }, userModelProvider)) ?? fail();
    userUlid = testUser.ulid ?? fail();
    testCase =
      (await createCase({ name: 'TheCase', status: CaseStatus.ACTIVE }, caseModelProvider)) ?? fail();
    caseUlid = testCase.ulid ?? fail();

    //list endpoints
    await createListData();
  });

  afterAll(async () => {
    await testTable.deleteTable('DeleteTableForever');
  });

  it('should create, get and update caseUser by ids', async () => {
    const caseUser: CaseUser = {
      userUlid,
      userFirstName: testUser.firstName,
      userLastName: testUser.lastName,
      caseUlid,
      caseName: testCase.name,
      actions: [CaseAction.UPLOAD],
    };
    const createdCaseUser = await createCaseUser(caseUser, caseUserModelProvider);

    expect(createdCaseUser).toEqual({
      ...caseUser,
      created: createdCaseUser.created,
      updated: createdCaseUser.updated,
    });

    const readCaseUser = await getCaseUser({ caseUlid, userUlid }, caseUserModelProvider);

    expect(readCaseUser).toEqual(createdCaseUser);

    const caseUserForUpdate: CaseUser = {
      ...caseUser,
      actions: [CaseAction.DOWNLOAD],
    };

    const updatedCaseUser = await updateCaseUser(caseUserForUpdate, caseUserModelProvider);

    expect(updatedCaseUser).toEqual({
      ...caseUserForUpdate,
      created: createdCaseUser.created,
      updated: updatedCaseUser?.updated,
    });

    await deleteAndVerifyCaseUser({ caseUlid, userUlid }, caseUserModelProvider);
  });

  it('should return undefined if a case is not found', async () => {
    const caseUser = await getCaseUser({ caseUlid: 'bogus', userUlid: 'bogus' }, caseUserModelProvider);

    expect(caseUser).toBeUndefined();
  });

  it('should list the first page of CaseUser by case', async () => {
    const expectedCaseUsers: Paged<CaseUser> = [
      {
        userUlid: listUser1Ulid,
        caseUlid: listCase1Ulid,
        caseName: listCase1.name,
        userFirstName: listUser1.firstName,
        userLastName: listUser1.lastName,
        actions: listCaseUser1_1.actions,
        created: listCaseUser1_1.created,
        updated: listCaseUser1_1.updated,
      },
      {
        userUlid: listUser2Ulid,
        caseUlid: listCase1Ulid,
        caseName: listCase1.name,
        userFirstName: listUser2.firstName,
        userLastName: listUser2.lastName,
        actions: listCaseUser2_1.actions,
        created: listCaseUser2_1.created,
        updated: listCaseUser2_1.updated,
      },
    ];
    expectedCaseUsers.count = 2;
    expectedCaseUsers.next = undefined;
    expectedCaseUsers.prev = undefined;

    const actualWithLimit1 = await listCaseUsersByCase(listCase1Ulid, 1, undefined, caseUserModelProvider);
    expect(actualWithLimit1.length).toEqual(1);
    const actual = await listCaseUsersByCase(listCase1Ulid, undefined, undefined, caseUserModelProvider);

    expect(actual.values).toEqual(expectedCaseUsers.values);
  });

  it('should list the first page of CaseUser by user', async () => {
    const expectedCaseUsers: Paged<CaseUser> = [
      {
        userUlid: listUser1Ulid,
        caseUlid: listCase1Ulid,
        caseName: listCase1.name,
        userFirstName: listUser1.firstName,
        userLastName: listUser1.lastName,
        actions: listCaseUser1_1.actions,
        created: listCaseUser1_1.created,
        updated: listCaseUser1_1.updated,
      },
      {
        userUlid: listUser1Ulid,
        caseUlid: listCase2Ulid,
        caseName: listCase2.name,
        userFirstName: listUser1.firstName,
        userLastName: listUser1.lastName,
        actions: listCaseUser1_2.actions,
        created: listCaseUser1_2.created,
        updated: listCaseUser1_2.updated,
      },
    ];
    expectedCaseUsers.count = 2;
    expectedCaseUsers.next = undefined;
    expectedCaseUsers.prev = undefined;

    const actualWithLimit1 = await listCaseUsersByUser(listUser1Ulid, 1, undefined, caseUserModelProvider);
    expect(actualWithLimit1.length).toEqual(1);
    const actual = await listCaseUsersByUser(listUser1Ulid, undefined, undefined, caseUserModelProvider);

    expect(actual.values).toEqual(expectedCaseUsers.values);
  });

  async function createListData(): Promise<void> {
    listUser1 = (await createUser({ firstName: 'Morgan', lastName: 'Freeman' }, userModelProvider)) ?? fail();
    listUser1Ulid = listUser1.ulid ?? fail();
    listUser2 = (await createUser({ firstName: 'Terry', lastName: 'Pratchet' }, userModelProvider)) ?? fail();
    listUser2Ulid = listUser2.ulid ?? fail();
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

    listCaseUser1_1 = await createCaseUser(
      {
        userUlid: listUser1Ulid,
        userFirstName: listUser1.firstName,
        userLastName: listUser1.lastName,
        caseUlid: listCase1Ulid,
        caseName: listCase1.name,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      },
      caseUserModelProvider
    );
    listCaseUser1_2 = await createCaseUser(
      {
        userUlid: listUser1Ulid,
        userFirstName: listUser1.firstName,
        userLastName: listUser1.lastName,
        caseUlid: listCase2Ulid,
        caseName: listCase2.name,
        actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.VIEW_FILES],
      },
      caseUserModelProvider
    );
    listCaseUser2_1 = await createCaseUser(
      {
        userUlid: listUser2Ulid,
        userFirstName: listUser2.firstName,
        userLastName: listUser2.lastName,
        caseUlid: listCase1Ulid,
        caseName: listCase1.name,
        actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.VIEW_FILES],
      },
      caseUserModelProvider
    );
  }
});

const deleteAndVerifyCaseUser = async (
  ulids: {
    readonly caseUlid: string;
    readonly userUlid: string;
  },
  modelProvider: CaseUserModelRepositoryProvider
) => {
  await deleteCaseUser(ulids, modelProvider);
  const deletedCaseUser = await getCaseUser(ulids, modelProvider);
  expect(deletedCaseUser).toBeUndefined();
};
