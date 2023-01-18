/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged, Table } from 'dynamodb-onetable';
import { DeaUser } from '../../models/user';
import { UserModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser, deleteUser, getUser, listUsers, updateUser } from '../../persistence/user';
import { initLocalDb } from './local-db-table';

describe('user persistence', () => {
    let testTable: Table;
    let modelProvider: UserModelRepositoryProvider;
    beforeAll(async () => {
        testTable = await initLocalDb("userTestsTable");
        modelProvider = { UserModel: testTable.getModel('User') };
    });

    afterAll(async () => {
        await testTable.deleteTable('DeleteTableForever');
    });

    it('should create and get a user by id', async () => {
        const firstName = 'Steve';
        const lastName = 'Zissou';

        const expectedUser: DeaUser = {
            firstName,
            lastName,
        };

        const createdUser = await createUser(expectedUser, modelProvider)
        if (!createdUser || !createdUser.ulid) {
            fail();
        } else {

            expect(createdUser).toEqual({ ...expectedUser, ulid: createdUser.ulid, created: createdUser.created, updated: createdUser.updated });

            const deaUser = await getUser(createdUser.ulid, modelProvider);

            expect(deaUser).toEqual({ ...expectedUser, ulid: createdUser.ulid, created: createdUser.created, updated: createdUser.updated });
            
            await deleteAndVerifyUser(createdUser.ulid, modelProvider);
        }
    });

    it('should return undefined if a user is not found', async () => {
        const caseUser = await getUser('bogus', modelProvider);

        expect(caseUser).toBeUndefined();
    });

    it('should list the first page of users', async () => {

        const firstName = 'Ralph';
        const lastName = 'Machio';

        const firstName2 = 'Randy';
        const lastName2 = 'Savage';

        const user1 = await createUser({ firstName, lastName }, modelProvider);
        const user2 = await createUser({
            firstName: firstName2,
            lastName: lastName2,
        }, modelProvider);

        if (!user1 || !user2 || !user1.ulid || !user2.ulid) {
            fail();
        }

        const expectedUsers: Paged<DeaUser> = [
            {
                ulid: user1.ulid,
                firstName,
                lastName,
                created: user1.created,
                updated: user1.updated,
            },
            {
                ulid: user2.ulid,
                firstName: firstName2,
                lastName: lastName2,
                created: user2.created,
                updated: user2.updated,
            },
        ];
        expectedUsers.count = 2;
        expectedUsers.next = undefined;
        expectedUsers.prev = undefined;

        const actual = await listUsers(20, undefined, modelProvider);

        expect(actual.values).toEqual(expectedUsers.values);

        deleteAndVerifyUser(user1.ulid, modelProvider);
        deleteAndVerifyUser(user2.ulid, modelProvider);
    });

    it('should update a user', async () => {

        const firstName = 'R';
        const lastName = 'V W';
        const updatedFirstName = 'Rip';
        const updatedLastName = 'Van Winkle';

        const deaUser: DeaUser = {
            firstName,
            lastName,
        }

        const createdUser = await createUser(deaUser, modelProvider);
        if (!createdUser || !createdUser.ulid) {
            //truthy expectation doesn't update createdUser type 
            fail();
        }
        expect(createdUser).toEqual({
            ...deaUser,
            ulid: createdUser.ulid,
            created: createdUser.created,
            updated: createdUser.updated,
        });

        const updatedUser: DeaUser = {
            ulid: createdUser.ulid,
            firstName: updatedFirstName,
            lastName: updatedLastName,
        };
        const actual = await updateUser(updatedUser, modelProvider);

        expect(actual).toEqual({
            ...updatedUser,
            created: createdUser.created,
            updated: actual?.updated,
        });

        await deleteAndVerifyUser(createdUser.ulid, modelProvider);
    });
});

const deleteAndVerifyUser = async (ulid: string, modelProvider: UserModelRepositoryProvider) => {
    await deleteUser(ulid, modelProvider);
    const deletedUser1 = await getUser(ulid, modelProvider);
    expect(deletedUser1).toBeUndefined();
}
