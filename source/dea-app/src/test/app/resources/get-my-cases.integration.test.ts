/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import { getMyCases } from "../../../app/resources/get-my-cases";
import { DeaCase } from "../../../models/case";
import { CaseAction } from "../../../models/case-action";
import { CaseStatus } from "../../../models/case-status";
import { createCase } from "../../../persistence/case";
import { createCaseUser } from "../../../persistence/case-user";
import { ModelRepositoryProvider } from "../../../persistence/schema/entities";
import { createUser } from "../../../persistence/user";
import { dummyContext, dummyEvent } from "../../integration-objects";
import { getTestRepositoryProvider } from "./get-test-repository";

let repositoryProvider: ModelRepositoryProvider;

type ResponseCasePage = {
    cases: DeaCase[],
    next: string | undefined,
};

describe('getMyCases', () => {

    beforeAll(async () => {
        repositoryProvider = await getTestRepositoryProvider('getMyCasesTest');
    });

    afterAll(async () => {
        await repositoryProvider.table.deleteTable('DeleteTableForever');
    });

    it('should only return cases to which a user has membership', async () => {

        // GIVEN a user with membership to case 1 and 2
        //create cases
        const case1 = await createCase({
            name: 'getMyCases-1',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        const case2 = await createCase({
            name: 'getMyCases-2',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        const case3 = await createCase({
            name: 'getMyCases-3',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        // create user
        const user = await createUser({
            firstName: 'Jackson',
            lastName: 'Wang',
        },
            repositoryProvider
        ) ?? fail();

        // create user-case memberships
        await createCaseUser({
            caseUlid: case1.ulid ?? 'bogus',
            userUlid: user.ulid ?? 'bogus',
            actions: [CaseAction.VIEW_CASE_DETAILS],
            caseName: case1.name,
            userFirstName: user.firstName,
            userLastName: user.lastName,
        },
            repositoryProvider
        );

        await createCaseUser({
            caseUlid: case2.ulid ?? 'bogus',
            userUlid: user.ulid ?? 'bogus',
            actions: [CaseAction.VIEW_CASE_DETAILS],
            caseName: case2.name,
            userFirstName: user.firstName,
            userLastName: user.lastName,
        },
            repositoryProvider
        );

        // WHEN requesting the user's cases
        // test sut
        const event = Object.assign({}, {
            ...dummyEvent,
            queryStringParameters: {
                userUlid: user.ulid,
                limit: '20',
            },
        });
        const response = await getMyCases(event, dummyContext, repositoryProvider);

        // THEN only cases with memberships (1 + 2) are returned
        // confirm memberships only returned
        if (!response.body) {
            fail();
        }

        const cases: DeaCase[] = JSON.parse(response.body).cases
        expect(cases.find(deacase => deacase.name === case1.name)).toBeDefined();
        expect(cases.find(deacase => deacase.name === case2.name)).toBeDefined();
        expect(cases.find(deacase => deacase.name === case3.name)).toBeUndefined();
    });

    it('should can fetch cases across pages', async () => {

        // GIVEN a user with membership to case 1 and 2
        //create cases
        const case1 = await createCase({
            name: 'getMyCases-1a',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        const case2 = await createCase({
            name: 'getMyCases-2a',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        const case3 = await createCase({
            name: 'getMyCases-3a',
            status: CaseStatus.ACTIVE,
        },
            repositoryProvider
        ) ?? fail();

        // create user
        const user = await createUser({
            firstName: 'Frank',
            lastName: 'Zappa',
        },
            repositoryProvider
        ) ?? fail();

        // create user-case memberships
        await createCaseUser({
            caseUlid: case1.ulid ?? 'bogus',
            userUlid: user.ulid ?? 'bogus',
            actions: [CaseAction.VIEW_CASE_DETAILS],
            caseName: case1.name,
            userFirstName: user.firstName,
            userLastName: user.lastName,
        },
            repositoryProvider
        );

        await createCaseUser({
            caseUlid: case2.ulid ?? 'bogus',
            userUlid: user.ulid ?? 'bogus',
            actions: [CaseAction.VIEW_CASE_DETAILS],
            caseName: case2.name,
            userFirstName: user.firstName,
            userLastName: user.lastName,
        },
            repositoryProvider
        );

        // WHEN requesting the first page user's cases
        // test sut
        const event = Object.assign({}, {
            ...dummyEvent,
            queryStringParameters: {
                userUlid: user.ulid,
                limit: '1'
            }
        });
        const response = await getMyCases(event, dummyContext, repositoryProvider);

        // THEN only cases with memberships (1 + 2) are returned
        // confirm memberships only returned
        if (!response.body) {
            fail();
        }

        const casesPage: ResponseCasePage = JSON.parse(response.body);
        expect(casesPage.cases.length).toEqual(1);
        expect(casesPage.next).toBeTruthy();

        const event2 = Object.assign({}, {
            ...dummyEvent,
            queryStringParameters: {
                userUlid: user.ulid,
                limit: '20',
                next: casesPage.next,
            }
        });
        const response2 = await getMyCases(event2, dummyContext, repositoryProvider);
        if (!response2.body) {
            fail();
        }
        const casesPage2: ResponseCasePage = JSON.parse(response2.body);
        expect(casesPage2.cases.length).toEqual(1);
        expect(casesPage2.next).toBeFalsy();

        const allCases = casesPage.cases.concat(casesPage2.cases);
        expect(allCases.find(deacase => deacase.name === case1.name)).toBeDefined();
        expect(allCases.find(deacase => deacase.name === case2.name)).toBeDefined();
        expect(allCases.find(deacase => deacase.name === case3.name)).toBeUndefined();
    });
});
