/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Model, Paged } from 'dynamodb-onetable';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { DeaUser } from '../../models/user';
import { UserType } from '../../persistence/schema/entities';
import { createUser, getUser, listUsers, updateUser } from '../../persistence/user';

describe('user persistence', () => {
    it('should get a user by id', async () => {
        const ulid = 'abc123';
        const firstName = 'Steve';
        const lastName = 'Zissou';
        const lowerFirstName = 'steve';
        const lowerLastName = 'zissou';

        const mockModel: Model<UserType> = mock();
        const getResponse: UserType = {
            PK: `USER#${ulid}#`,
            SK: `USER#`,
            ulid,
            firstName,
            lastName,
            lowerFirstName,
            lowerLastName,
        };

        when(
            mockModel.get(
                deepEqual({
                    PK: `USER#${ulid}#`,
                    SK: `USER#`,
                })
            )
        ).thenResolve(getResponse);

        const expectedUser: DeaUser = {
            ulid,
            firstName,
            lastName,
        };

        const deaUser = await getUser(ulid, { UserModel: instance(mockModel) });

        verify(
            mockModel.get(
                deepEqual({
                    PK: `USER#${ulid}#`,
                    SK: `USER#`,
                })
            )
        ).once();

        expect(deaUser).toEqual(expectedUser);
    });

    it('should return undefined if a user is not found', async () => {
        const ulid = 'abc123';
        const mockModel: Model<UserType> = mock();

        when(
            mockModel.get(
                deepEqual({
                    PK: `USER#${ulid}#`,
                    SK: `USER#`,
                })
            )
        ).thenResolve(undefined);

        const caseUser = await getUser(ulid, { UserModel: instance(mockModel) });

        verify(
            mockModel.get(
                deepEqual({
                    PK: `USER#${ulid}#`,
                    SK: `USER#`,
                })
            )
        ).once();

        expect(caseUser).toBeUndefined();
    });

    it('should list the first page of users', async () => {
        const mockModel: Model<UserType> = mock();

        const ulid = '123abc';
        const firstName = 'Ralph';
        const lastName = 'Machio';
        const lowerFirstName = 'ralph';
        const lowerLastName = 'machio';

        const ulid2 = '456abc';
        const firstName2 = 'Randy';
        const lastName2 = 'Savage';
        const lowerFirstName2 = 'randy';
        const lowerLastName2 = 'savage';

        const findResponse: Paged<UserType> = [
            {
                PK: `USER#${ulid}#`,
                SK: `USER#`,
                ulid,
                firstName,
                lastName,
                lowerFirstName,
                lowerLastName,
            },
            {
                PK: `USER#${ulid2}#`,
                SK: `USER#`,
                ulid: ulid2,
                firstName: firstName2,
                lastName: lastName2,
                lowerFirstName: lowerFirstName2,
                lowerLastName: lowerLastName2,
            },
        ];
        findResponse.count = 2;
        findResponse.next = undefined;
        findResponse.prev = undefined;

        when(
            mockModel.find(
                deepEqual({
                    GSI1PK: 'USER#',
                    GSI1SK: {
                        begins_with: 'USER#',
                    },
                }),
                deepEqual({
                    next: undefined,
                    limit: 20,
                    index: 'GSI1',
                })
            )
        ).thenResolve(findResponse);

        const expectedUsers: Paged<DeaUser> = [
            {
                ulid,
                firstName,
                lastName,
            },
            {
                ulid: ulid2,
                firstName: firstName2,
                lastName: lastName2,
            },
        ];
        expectedUsers.count = 2;
        expectedUsers.next = undefined;
        expectedUsers.prev = undefined;

        const actual = await listUsers(20, undefined, { UserModel: instance(mockModel) });

        verify(
            mockModel.find(
                deepEqual({
                    GSI1PK: 'USER#',
                    GSI1SK: {
                        begins_with: 'USER#',
                    },
                }),
                deepEqual({
                    next: undefined,
                    limit: 20,
                    index: 'GSI1',
                })
            )
        ).once();

        expect(actual).toEqual(expectedUsers);
    });

    it('should create a case', async () => {
        const mockModel: Model<UserType> = mock();

        const ulid = '456abc';
        const firstName = 'Count';
        const lastName = 'Chocula';
        const lowerFirstName = 'count';
        const lowerLastName = 'chocula';

        const responseEntity: UserType = {
            PK: `USER#${ulid}#`,
            SK: `USER#`,
            ulid,
            firstName,
            lastName,
            lowerFirstName,
            lowerLastName,
        };

        const deaUser: DeaUser = {
            ulid,
            firstName,
            lastName,
        }

        when(
            mockModel.create(
                deepEqual({
                    ...deaUser,
                    lowerFirstName,
                    lowerLastName,
                }),
            )
        ).thenResolve(responseEntity);

        const actual = await createUser(deaUser, { UserModel: instance(mockModel) });

        verify(
            mockModel.create(
                deepEqual({
                    ...deaUser,
                    lowerFirstName,
                    lowerLastName,
                }),
            )
        ).once();

        expect(actual).toEqual(deaUser);
    });

    it('should create a case', async () => {
        const mockModel: Model<UserType> = mock();

        const ulid = '456abc';
        const firstName = 'Count';
        const lastName = 'Chocula';
        const lowerFirstName = 'count';
        const lowerLastName = 'chocula';

        const responseEntity: UserType = {
            PK: `USER#${ulid}#`,
            SK: `USER#`,
            ulid,
            firstName,
            lastName,
            lowerFirstName,
            lowerLastName,
        };

        const deaUser: DeaUser = {
            ulid,
            firstName,
            lastName,
        }

        when(
            mockModel.update(
                deepEqual({
                    ...deaUser,
                    lowerFirstName,
                    lowerLastName,
                }),
            )
        ).thenResolve(responseEntity);

        const actual = await updateUser(deaUser, { UserModel: instance(mockModel) });

        verify(
            mockModel.update(
                deepEqual({
                    ...deaUser,
                    lowerFirstName,
                    lowerLastName,
                }),
            )
        ).once();

        expect(actual).toEqual(deaUser);
    });
});
