/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaUser, DeaUserInput } from '../../models/user';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser, deleteUser, getUser, listUsers, updateUser } from '../../persistence/user';
import { getTestRepositoryProvider } from './local-db-table';

describe('user persistence', () => {
  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('userTestsTable');
  });

  afterAll(async () => {
    await modelProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create and get a user by id', async () => {
    const firstName = 'Steve';
    const lastName = 'Zissou';
    const tokenId = 'stevezissou';

    const expectedUser: DeaUserInput = {
      tokenId,
      firstName,
      lastName,
    };

    const createdUser = await createUser(expectedUser, modelProvider);
    expect(createdUser).toEqual({
      ...expectedUser,
      ulid: createdUser.ulid,
      created: createdUser.created,
      updated: createdUser.updated,
    });

    const deaUser = await getUser(createdUser.ulid, modelProvider);

    expect(deaUser).toEqual({
      ...expectedUser,
      ulid: createdUser.ulid,
      created: createdUser.created,
      updated: createdUser.updated,
    });

    await deleteAndVerifyUser(createdUser.ulid, modelProvider);
  });

  it('should return undefined if a user is not found', async () => {
    const caseUser = await getUser('bogus', modelProvider);

    expect(caseUser).toBeUndefined();
  });

  it('should list the first page of users', async () => {
    const firstName = 'Ralph';
    const lastName = 'Machio';
    const tokenId = 'ralphamachio';

    const firstName2 = 'Randy';
    const lastName2 = 'Savage';
    const tokenId2 = 'randysavage';

    const user1 = await createUser({ tokenId, firstName, lastName }, modelProvider);
    const user2 = await createUser(
      {
        tokenId: tokenId2,
        firstName: firstName2,
        lastName: lastName2,
      },
      modelProvider
    );

    const expectedUsers: Paged<DeaUser> = [
      {
        ulid: user1.ulid,
        tokenId,
        firstName,
        lastName,
        created: user1.created,
        updated: user1.updated,
      },
      {
        ulid: user2.ulid,
        tokenId: tokenId2,
        firstName: firstName2,
        lastName: lastName2,
        created: user2.created,
        updated: user2.updated,
      },
    ];
    expectedUsers.count = 2;
    expectedUsers.next = undefined;
    expectedUsers.prev = undefined;

    const actualWithLimit1 = await listUsers(
      /*nameBeginsWith=*/ undefined,
      modelProvider,
      /*next*/ undefined,
      1
    );
    expect(actualWithLimit1).toHaveLength(1);
    const actual = await listUsers(/*nameBeginsWith=*/ undefined, modelProvider, /*next*/ undefined);

    expect(actual.values).toEqual(expectedUsers.values);

    await deleteAndVerifyUser(user1.ulid, modelProvider);
    await deleteAndVerifyUser(user2.ulid, modelProvider);
  });

  it('should update a user', async () => {
    const firstName = 'R';
    const lastName = 'V W';
    const tokenId = 'rvw';
    const updatedFirstName = 'Rip';
    const updatedLastName = 'Van Winkle';

    const deaUser: DeaUserInput = {
      tokenId,
      firstName,
      lastName,
    };

    const createdUser = await createUser(deaUser, modelProvider);
    expect(createdUser).toEqual({
      ...deaUser,
      ulid: createdUser.ulid,
      created: createdUser.created,
      updated: createdUser.updated,
    });

    const updatedUser: DeaUser = {
      ulid: createdUser.ulid,
      tokenId,
      firstName: updatedFirstName,
      lastName: updatedLastName,
    };
    const actual = await updateUser(updatedUser, modelProvider);

    expect(actual.firstName).toStrictEqual(updatedFirstName);
    expect(actual.lastName).toStrictEqual(updatedLastName);
    expect(actual.tokenId).toStrictEqual(tokenId);
    expect(actual.ulid).toStrictEqual(createdUser.ulid);
    // const createDate = actual.created ?? fail();

    // console.log(actual);
    // expect(actual.updated?.getTime()).toBeGreaterThan(createDate.getTime());

    expect(actual).toEqual({
      ...updatedUser,
      created: createdUser.created,
      updated: actual?.updated,
    });
    expect(actual.created).toBeDefined();
    expect(actual.created).toStrictEqual(createdUser.created);

    await deleteAndVerifyUser(createdUser.ulid, modelProvider);
  });
});

const deleteAndVerifyUser = async (ulid: string, modelProvider: ModelRepositoryProvider) => {
  await deleteUser(ulid, modelProvider);
  const deletedUser1 = await getUser(ulid, modelProvider);
  expect(deletedUser1).toBeUndefined();
};
