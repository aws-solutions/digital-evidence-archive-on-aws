/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { createCaseSuccess, deleteCase, validateStatus } from './test-helpers';

describe('get all cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'getAllCasesTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;
  const region = envSettings.awsRegion;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup');
  });

  afterAll(async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, creds);
    }
    await cognitoHelper.cleanup();
  }, 10000);

  it('should get all cases', async () => {
    const client = axios.create();
    const creds = await cognitoHelper.getCredentialsForUser(testUser);

    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
        region: region,
      },
      creds
    );

    client.interceptors.request.use(interceptor);

    const caseNames = ['getAllCases-Case1', 'getAllCases-Case2', 'getAllCases-Case3', 'getAllCases-Case4'];
    const createdCases: DeaCase[] = [];
    for (const caseName of caseNames) {
      createdCases.push(
        await createCaseSuccess(
          deaApiUrl,
          {
            name: caseName,
            status: CaseStatus.ACTIVE,
            description: 'some case description',
          },
          creds
        )
      );
    }
    createdCases.forEach((createdCase) => caseIdsToDelete.push(createdCase.ulid ?? fail()));

    const getResponse = await client.get(`${deaApiUrl}cases/all-cases`, {
      validateStatus,
    });

    expect(getResponse.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCases = (await getResponse.data.cases) as DeaCase[];
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
  }, 20000);
});
