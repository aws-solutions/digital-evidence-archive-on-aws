/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { getAllCases } from '../../../app/resources/get-all-cases';
import { createUser } from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

type ResponseCasePage = {
  cases: DeaCase[];
  next: string | undefined;
};

describe('get all cases resource', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let testProviders: LambdaProviders;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getAllCasesTest');
    testProviders = createTestProvidersObject({ repositoryProvider });
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should can fetch cases across pages', async () => {
    const user1 = await createUser(
      {
        tokenId: 'creator1',
        idPoolId: 'creator1identityid',
        firstName: 'Create',
        lastName: 'One',
      },
      repositoryProvider
    );

    const user2 = await createUser(
      {
        tokenId: 'creator2',
        idPoolId: 'creator2identityid',
        firstName: 'Create',
        lastName: 'Two',
      },
      repositoryProvider
    );

    const case1 =
      (await createCase(
        {
          name: 'getMyCases-1a',
        },
        user1,
        repositoryProvider
      )) ?? fail();

    const case2 =
      (await createCase(
        {
          name: 'getMyCases-2a',
        },
        user2,
        repositoryProvider
      )) ?? fail();

    const case3 =
      (await createCase(
        {
          name: 'getMyCases-3a',
        },
        user1,
        repositoryProvider
      )) ?? fail();

    const event = getDummyEvent({
      queryStringParameters: {
        limit: '1',
      },
    });
    const response = await getAllCases(event, dummyContext, testProviders);

    if (!response.body) {
      fail();
    }

    const casesPage: ResponseCasePage = JSON.parse(response.body);
    expect(casesPage.cases.length).toEqual(1);
    expect(casesPage.next).toBeTruthy();

    const event2 = getDummyEvent({
      queryStringParameters: {
        next: casesPage.next,
      },
    });
    const response2 = await getAllCases(event2, dummyContext, testProviders);
    if (!response2.body) {
      fail();
    }
    const casesPage2: ResponseCasePage = JSON.parse(response2.body);
    expect(casesPage2.cases.length).toEqual(2);
    expect(casesPage2.next).toBeFalsy();

    const allCases = casesPage.cases.concat(casesPage2.cases);
    expect(allCases.find((deacase) => deacase.name === case1.name)).toBeDefined();
    expect(allCases.find((deacase) => deacase.name === case2.name)).toBeDefined();
    expect(allCases.find((deacase) => deacase.name === case3.name)).toBeDefined();
  });
});
