/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import Joi from "joi";
import { NotFoundError } from "../../../app/exceptions/not-found-exception";
import { ValidationError } from "../../../app/exceptions/validation-exception";
import { createCaseMembership } from "../../../app/resources/create-case-membership";
import * as CaseService from "../../../app/services/case-service";
import * as UserService from "../../../app/services/user-service";
import { DeaCase } from "../../../models/case";
import { CaseAction } from "../../../models/case-action";
import { CaseStatus } from "../../../models/case-status";
import { CaseUser } from "../../../models/case-user";
import { DeaUser } from "../../../models/user";
import { caseUserResponseSchema } from "../../../models/validation/case-user";
import { jsonParseWithDates } from "../../../models/validation/json-parse-with-dates";
import { ModelRepositoryProvider } from "../../../persistence/schema/entities";
import { dummyContext, dummyEvent } from "../../integration-objects";
import { getTestRepositoryProvider } from "./get-test-repository";

let repositoryProvider: ModelRepositoryProvider;

describe('create case membership resource', () => {

    beforeAll(async () => {
        repositoryProvider = await getTestRepositoryProvider('createCaseMembershipTest');
    });

    afterAll(async () => {
        await repositoryProvider.table.deleteTable('DeleteTableForever');
    });

    it('should create a user-case membership', async () => {
        const deaUser: DeaUser = {
            tokenId: 'arthur@morgan.com',
            firstName: 'Arthur',
            lastName: 'Morgan',
        };
        const user = await UserService.createUser(deaUser, repositoryProvider);

        const deaCase: DeaCase = {
            name: 'ThirteenSilverDollars',
            status: CaseStatus.ACTIVE,
        };
        const newCase = await CaseService.createCases(deaCase, repositoryProvider);

        if (!newCase.ulid || !user.ulid) {
            fail();
        }

        const event = Object.assign(
            {},
            {
                ...dummyEvent,
                pathParameters: {
                    caseId: newCase.ulid,
                },
                body: JSON.stringify({
                    userUlid: user.ulid,
                    caseUlid: newCase.ulid,
                    actions: [CaseAction.VIEW_CASE_DETAILS],
                }),
            }
        );

        const response = await createCaseMembership(event, dummyContext, repositoryProvider);

        expect(response.statusCode).toEqual(200);

        if (!response.body) {
            fail();
        }

        const createdMembership: CaseUser = jsonParseWithDates(response.body);

        Joi.assert(createdMembership, caseUserResponseSchema);
        expect(createdMembership.caseName).toEqual(deaCase.name);
        expect(createdMembership.userFirstName).toEqual(user.firstName);
        expect(createdMembership.userLastName).toEqual(user.lastName);
        expect(createdMembership.caseUlid).toEqual(newCase.ulid);
        expect(createdMembership.userUlid).toEqual(user.ulid);
        expect(createdMembership.actions).toEqual([CaseAction.VIEW_CASE_DETAILS]);
    });

    it('should error if the path param is not provided', async () => {
        await expect(createCaseMembership(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(ValidationError);
    });

    it('should error if no payload is provided', async () => {
        const event = Object.assign(
            {},
            {
                ...dummyEvent,
                pathParameters: {
                    caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
                },
                body: undefined,
            }
        );

        expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
            'CaseUser payload missing.'
        );
    });

    it('should error if the resource and path ids do not match', () => {
        const ulid1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
        const ulid2 = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
        const ulid3 = '03ARZ3NDEKTSV4RRFFQ69G5FAV';
        const event = Object.assign(
            {},
            {
                ...dummyEvent,
                pathParameters: {
                    caseId: ulid1,
                },
                body: JSON.stringify({
                    userUlid: ulid3,
                    caseUlid: ulid2,
                    actions: [CaseAction.VIEW_CASE_DETAILS],
                }),
            }
        );

        expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
            'Requested Case Ulid does not match resource'
        );
    });

    it('should error if the case does not exist', async () => {
        const deaUser: DeaUser = {
            tokenId: 'michah@bell.com',
            firstName: 'Micah',
            lastName: 'Bell',
        };
        const user = await UserService.createUser(deaUser, repositoryProvider);

        const bogusUlid = '02ARZ3NDEKTSV4RRFFQ69G5FDV';
        const event = Object.assign(
            {},
            {
                ...dummyEvent,
                pathParameters: {
                    caseId: bogusUlid,
                },
                body: JSON.stringify({
                    userUlid: user.ulid,
                    caseUlid: bogusUlid,
                    actions: [CaseAction.VIEW_CASE_DETAILS]
                }),
            }
        );

        await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
        await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(`Case with ulid ${bogusUlid} not found.`);
    });

    it('should error if the user does not exist', async () => {
        const deaCase: DeaCase = {
            name: 'Bar Breaker',
            status: CaseStatus.ACTIVE,
        };
        const newCase = await CaseService.createCases(deaCase, repositoryProvider);

        const bogusUlid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
        const event = Object.assign(
            {},
            {
                ...dummyEvent,
                pathParameters: {
                    caseId: newCase.ulid,
                },
                body: JSON.stringify({
                    userUlid: bogusUlid,
                    caseUlid: newCase.ulid,
                    actions: [CaseAction.VIEW_CASE_DETAILS]
                }),
            }
        );

        await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
        await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(`User with ulid ${bogusUlid} not found.`);
    });
});
