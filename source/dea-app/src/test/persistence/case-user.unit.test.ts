/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Model, Paged } from 'dynamodb-onetable';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { CaseAction } from '../../models/case-action';
import { CaseUser } from '../../models/case-user';
import { createCaseUser, getCaseUser, listCaseUsersByCase, listCaseUsersByUser, updateCaseUser } from '../../persistence/case-user';
import { CaseUserType } from '../../persistence/schema/entities';

describe('caseUser persistence', () => {
    it('should get a caseUser by ids', async () => {
        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const caseName = 'Case ay be see';
        const userFirstName = 'Morgan';
        const userLastName = 'Freeman';
        const userFirstNameLower = 'morgan';
        const userLastNameLower = 'freeman';
        const actions = [CaseAction.VIEW_CASE_DETAILS];

        const mockModel: Model<CaseUserType> = mock();
        const getResponse: CaseUserType = {
            PK: `USER#${userUlid}#`,
            SK: `CASE#${caseUlid}#`,
            caseUlid,
            userUlid,
            caseName,
            userFirstName,
            userLastName,
            userFirstNameLower,
            userLastNameLower,
            actions,
        };

        when(
            mockModel.get(
                deepEqual({
                    PK: `USER#${userUlid}#`,
                    SK: `CASE#${caseUlid}#`,
                })
            )
        ).thenResolve(getResponse);

        const expectedCaseUser: CaseUser = {
            userUlid,
            caseUlid,
            caseName,
            userFirstName,
            userLastName,
            actions,
        };

        const caseUser = await getCaseUser({ caseUlid, userUlid }, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.get(
                deepEqual({
                    PK: `USER#${userUlid}#`,
                    SK: `CASE#${caseUlid}#`,
                })
            )
        ).once();

        expect(caseUser).toEqual(expectedCaseUser);
    });

    it('should return undefined if a case is not found', async () => {
        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const mockModel: Model<CaseUserType> = mock();

        when(
            mockModel.get(
                deepEqual({
                    PK: `USER#${userUlid}#`,
                    SK: `CASE#${caseUlid}#`,
                })
            )
        ).thenResolve(undefined);

        const caseUser = await getCaseUser({ caseUlid, userUlid }, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.get(
                deepEqual({
                    PK: `USER#${userUlid}#`,
                    SK: `CASE#${caseUlid}#`,
                })
            )
        ).once();

        expect(caseUser).toBeUndefined();
    });

    it('should list the first page of CaseUser by case', async () => {
        const mockModel: Model<CaseUserType> = mock();

        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const caseName = 'Case ay be see';
        const userFirstName = 'Morgan';
        const userLastName = 'Freeman';
        const userFirstNameLower = 'morgan';
        const userLastNameLower = 'freeman';
        const actions = [CaseAction.VIEW_CASE_DETAILS];

        const userUlid2 = 'abc456';
        const userFirstName2 = 'Terry';
        const userLastName2 = 'Pratchet';
        const userFirstNameLower2 = 'terry';
        const userLastNameLower2 = 'pratchet';
        const actions2 = [CaseAction.VIEW_CASE_DETAILS, CaseAction.VIEW_FILES];

        const findResponse: Paged<CaseUserType> = [
            {
                PK: `USER#${userUlid}#`,
                SK: `CASE#${caseUlid}#`,
                caseUlid,
                userUlid,
                caseName,
                userFirstName,
                userLastName,
                userFirstNameLower,
                userLastNameLower,
                actions,
            },
            {
                PK: `USER#${userUlid2}#`,
                SK: `CASE#${caseUlid}#`,
                caseUlid,
                userUlid: userUlid2,
                caseName,
                userFirstName: userFirstName2,
                userLastName: userLastName2,
                userFirstNameLower: userFirstNameLower2,
                userLastNameLower: userLastNameLower2,
                actions: actions2,
            },
        ];
        findResponse.count = 2;
        findResponse.next = undefined;
        findResponse.prev = undefined;

        when(
            mockModel.find(
                deepEqual({
                    GSI1PK: `CASE#${caseUlid}`,
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

        const expectedCaseUsers: Paged<CaseUser> = [
            {
                userUlid,
                caseUlid,
                caseName,
                userFirstName,
                userLastName,
                actions,
            },
            {
                userUlid: userUlid2,
                caseUlid,
                caseName,
                userFirstName: userFirstName2,
                userLastName: userLastName2,
                actions: actions2,
            },
        ];
        expectedCaseUsers.count = 2;
        expectedCaseUsers.next = undefined;
        expectedCaseUsers.prev = undefined;

        const actual = await listCaseUsersByCase(caseUlid, 20, undefined, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.find(
                deepEqual({
                    GSI1PK: `CASE#${caseUlid}`,
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

        expect(actual).toEqual(expectedCaseUsers);
    });

    it('should list the first page of CaseUser by user', async () => {
        const mockModel: Model<CaseUserType> = mock();

        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const caseName = 'Case ay be see';
        const userFirstName = 'Morgan';
        const userLastName = 'Freeman';
        const userFirstNameLower = 'morgan';
        const userLastNameLower = 'freeman';
        const actions = [CaseAction.VIEW_CASE_DETAILS];

        const caseUlid2 = '456abc';
        const caseName2 = '2001: A Case Odyssey'
        const actions2 = [CaseAction.VIEW_CASE_DETAILS, CaseAction.VIEW_FILES];

        const findResponse: Paged<CaseUserType> = [
            {
                PK: `USER#${userUlid}#`,
                SK: `CASE#${caseUlid}#`,
                caseUlid,
                userUlid,
                caseName,
                userFirstName,
                userLastName,
                userFirstNameLower,
                userLastNameLower,
                actions,
            },
            {
                PK: `USER#${userUlid}#`,
                SK: `CASE#${caseUlid2}#`,
                caseUlid: caseUlid2,
                userUlid: userUlid,
                caseName: caseName2,
                userFirstName,
                userLastName,
                userFirstNameLower,
                userLastNameLower,
                actions: actions2,
            },
        ];
        findResponse.count = 2;
        findResponse.next = undefined;
        findResponse.prev = undefined;

        when(
            mockModel.find(
                deepEqual({
                    GSI1PK: `USER#${userUlid}`,
                    GSI1SK: {
                        begins_with: 'CASE#',
                    },
                }),
                deepEqual({
                    next: undefined,
                    limit: 20,
                    index: 'GSI2',
                })
            )
        ).thenResolve(findResponse);

        const expectedCaseUsers: Paged<CaseUser> = [
            {
                userUlid,
                caseUlid,
                caseName,
                userFirstName,
                userLastName,
                actions,
            },
            {
                userUlid,
                caseUlid: caseUlid2,
                caseName: caseName2,
                userFirstName,
                userLastName,
                actions: actions2,
            },
        ];
        expectedCaseUsers.count = 2;
        expectedCaseUsers.next = undefined;
        expectedCaseUsers.prev = undefined;

        const actual = await listCaseUsersByUser(userUlid, 20, undefined, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.find(
                deepEqual({
                    GSI1PK: `USER#${userUlid}`,
                    GSI1SK: {
                        begins_with: 'CASE#',
                    },
                }),
                deepEqual({
                    next: undefined,
                    limit: 20,
                    index: 'GSI2',
                })
            )
        ).once();

        expect(actual).toEqual(expectedCaseUsers);
    });

    it('should create a case', async () => {
        const mockModel: Model<CaseUserType> = mock();

        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const caseName = 'Case ay be see';
        const userFirstName = 'Morgan';
        const userLastName = 'Freeman';
        const userFirstNameLower = 'morgan';
        const userLastNameLower = 'freeman';
        const actions = [CaseAction.VIEW_CASE_DETAILS];

        const responseEntity: CaseUserType = {
            PK: `USER#${userUlid}#`,
            SK: `CASE#${caseUlid}#`,
            caseUlid,
            userUlid,
            caseName,
            userFirstName,
            userLastName,
            userFirstNameLower,
            userLastNameLower,
            actions,
        };

        const caseUser: CaseUser = {
            caseUlid,
            userUlid,
            caseName,
            userFirstName,
            userLastName,
            actions,
        }

        when(
            mockModel.create(
                deepEqual({
                    ...caseUser,
                    userFirstNameLower,
                    userLastNameLower,
                }),
            )
        ).thenResolve(responseEntity);

        const actual = await createCaseUser(caseUser, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.create(
                deepEqual({
                    ...caseUser,
                    userFirstNameLower,
                    userLastNameLower,
                }),
            )
        ).once();

        expect(actual).toEqual(caseUser);
    });

    it('should update a case-user', async () => {
        const mockModel: Model<CaseUserType> = mock();

        const caseUlid = '123abc';
        const userUlid = 'abc123';
        const caseName = 'Case ay be see';
        const userFirstName = 'Morgan';
        const userLastName = 'Freeman';
        const userFirstNameLower = 'morgan';
        const userLastNameLower = 'freeman';
        const actions = [CaseAction.VIEW_CASE_DETAILS];

        const responseEntity: CaseUserType = {
            PK: `USER#${userUlid}#`,
            SK: `CASE#${caseUlid}#`,
            caseUlid,
            userUlid,
            caseName,
            userFirstName,
            userLastName,
            userFirstNameLower,
            userLastNameLower,
            actions,
        };

        const caseUser: CaseUser = {
            caseUlid,
            userUlid,
            caseName,
            userFirstName,
            userLastName,
            actions,
        }

        when(
            mockModel.update(
                deepEqual({
                    ...caseUser,
                    userFirstNameLower,
                    userLastNameLower,
                }),
            )
        ).thenResolve(responseEntity);

        const actual = await updateCaseUser(caseUser, { CaseUserModel: instance(mockModel) });

        verify(
            mockModel.update(
                deepEqual({
                    ...caseUser,
                    userFirstNameLower,
                    userLastNameLower,
                }),
            )
        ).once();

        expect(actual).toEqual(caseUser);
    });
});
