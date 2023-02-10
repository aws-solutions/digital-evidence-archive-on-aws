/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { getMyCases } from '../../../app/resources/get-my-cases';
import { DeaCase } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { createCase } from '../../../persistence/case';
import { createCaseUser } from '../../../persistence/case-user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

type ResponseCasePage = {
  cases: DeaCase[];
  next: string | undefined;
};

describe('getMyCases', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getMyCasesTest');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterEach(async () => {
    delete dummyEvent.headers['userUlid'];
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should only return cases to which a user has membership', async () => {
    // GIVEN a user with membership to case 1 and 2
    //create cases
    const case1 =
      (await createCase(
        {
          name: 'getMyCases-1',
          status: CaseStatus.ACTIVE,
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    const case2 =
      (await createCase(
        {
          name: 'getMyCases-2',
          status: CaseStatus.ACTIVE,
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    const case3 =
      (await createCase(
        {
          name: 'getMyCases-3',
          status: CaseStatus.ACTIVE,
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    // create user
    const user =
      (await createUser(
        {
          tokenId: 'jacksonwang',
          firstName: 'Jackson',
          lastName: 'Wang',
        },
        repositoryProvider
      )) ?? fail();

    // create user-case memberships
    await createCaseUser(
      {
        caseUlid: case1.ulid ?? 'bogus',
        userUlid: user.ulid ?? 'bogus',
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: case1.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    await createCaseUser(
      {
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
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          limit: '20',
        },
      }
    );
    // simulate runLambdaPreChecks by adding the userUlid to the event
    // the integration between runLambdaPrechecks and this lambda handler
    // will be tested in the e2e tests
    event.headers['userUlid'] = user.ulid;
    const response = await getMyCases(event, dummyContext, repositoryProvider);

    // THEN only cases with memberships (1 + 2) are returned
    // confirm memberships only returned
    if (!response.body) {
      fail();
    }

    const cases: DeaCase[] = JSON.parse(response.body).cases;
    expect(cases.find((deacase) => deacase.name === case1.name)).toBeDefined();
    expect(cases.find((deacase) => deacase.name === case2.name)).toBeDefined();
    expect(cases.find((deacase) => deacase.name === case3.name)).toBeUndefined();
  });

  it('should can fetch cases across pages', async () => {
    // GIVEN a user with many memberships
    //create cases
    // create user
    const user =
      (await createUser(
        {
          tokenId: 'frankzappa',
          firstName: 'Frank',
          lastName: 'Zappa',
        },
        repositoryProvider
      )) ?? fail();

    for (let i = 0; i < 28; ++i) {
      const theCase =
        (await createCase(
          {
            name: `getMyCases-a${i}`,
            status: CaseStatus.ACTIVE,
          },
          caseOwner,
          repositoryProvider
        )) ?? fail();

      // create user-case memberships
      await createCaseUser(
        {
          caseUlid: theCase.ulid ?? 'bogus',
          userUlid: user.ulid ?? 'bogus',
          actions: [CaseAction.VIEW_CASE_DETAILS],
          caseName: theCase.name,
          userFirstName: user.firstName,
          userLastName: user.lastName,
        },
        repositoryProvider
      );
    }

    // WHEN requesting the first page user's cases
    // test sut
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          userUlid: user.ulid,
          limit: '1',
        },
      }
    );
    // simulate runLambdaPreChecks by adding the userUlid to the event
    // the integration between runLambdaPrechecks and this lambda handler
    // will be tested in the e2e tests
    event.headers['userUlid'] = user.ulid;
    const response = await getMyCases(event, dummyContext, repositoryProvider);

    // THEN only cases with memberships are returned
    // confirm memberships only returned
    if (!response.body) {
      fail();
    }

    const casesPage: ResponseCasePage = JSON.parse(response.body);
    expect(casesPage.cases.length).toEqual(1);
    expect(casesPage.next).toBeTruthy();

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          userUlid: user.ulid,
          next: casesPage.next,
        },
      }
    );
    const response2 = await getMyCases(event2, dummyContext, repositoryProvider);
    if (!response2.body) {
      fail();
    }
    const casesPage2: ResponseCasePage = JSON.parse(response2.body);
    expect(casesPage2.cases.length).toEqual(27);
    expect(casesPage2.next).toBeFalsy();
  });

  it('should fail when the userUlid is not present in the event', async () => {
    // runLambdaPreChecks inserts the userUlid into the event header so dea lambda
    // execution will not have to reverify and decode the cognito token and
    // grab the user from the database.
    // Therefore, if the event does not contain the ulid, GetMyCases should fail
    // GIVEN a user with membership to case 1 and 2
    //create cases
    const case1 =
      (await createCase(
        {
          name: 'getMyCases-1c',
          status: CaseStatus.ACTIVE,
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    // create user
    const user =
      (await createUser(
        {
          tokenId: 'michaeljack',
          firstName: 'Michael',
          lastName: 'Jack',
        },
        repositoryProvider
      )) ?? fail();

    // create user-case memberships
    await createCaseUser(
      {
        caseUlid: case1.ulid ?? 'bogus',
        userUlid: user.ulid ?? 'bogus',
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: case1.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    // WHEN requesting the user's cases
    // test sut
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          limit: '20',
        },
      }
    );

    await expect(getMyCases(event, dummyContext, repositoryProvider)).rejects.toThrowError(
      'userUlid was not present in the event header'
    );
  });
});
