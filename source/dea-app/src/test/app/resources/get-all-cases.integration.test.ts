/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { getAllCases } from '../../../app/resources/get-all-cases';
import { DeaCase } from '../../../models/case';
import { CaseStatus } from '../../../models/case-status';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from './get-test-repository';

let repositoryProvider: ModelRepositoryProvider;

type ResponseCasePage = {
  cases: DeaCase[];
  next: string | undefined;
};

describe('get all cases resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getAllCasesTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should can fetch cases across pages', async () => {
    const case1 =
      (await createCase(
        {
          name: 'getMyCases-1a',
          status: CaseStatus.ACTIVE,
        },
        repositoryProvider
      )) ?? fail();

    const case2 =
      (await createCase(
        {
          name: 'getMyCases-2a',
          status: CaseStatus.ACTIVE,
        },
        repositoryProvider
      )) ?? fail();

    const case3 =
      (await createCase(
        {
          name: 'getMyCases-3a',
          status: CaseStatus.ACTIVE,
        },
        repositoryProvider
      )) ?? fail();

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          limit: '1',
        },
      }
    );
    const response = await getAllCases(event, dummyContext, repositoryProvider);

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
          next: casesPage.next,
        },
      }
    );
    const response2 = await getAllCases(event2, dummyContext, repositoryProvider);
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
