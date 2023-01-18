/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { createCaseSuccess, deleteCase, validateStatus } from './test-helpers';

describe('get case api', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'getCaseE2ETestUser';
  const deaApiUrl = envSettings.apiUrlOutput;
  const region = envSettings.awsRegion;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'GetCaseTestGroup');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should get a created case', async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);
    const client = axios.create();

    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
        region: region,
      },
      creds
    );

    client.interceptors.request.use(interceptor);

    // Create Case
    const caseName = 'caseWithDetails';
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'this is a description',
      },
      creds
    );

    // Now call Get and Check response is what we created
    const getResponse = await client.get(`${deaApiUrl}cases/${createdCase.ulid}`, {
      validateStatus,
    });

    expect(getResponse.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCase = (await getResponse.data) as DeaCase;
    Joi.assert(fetchedCase, caseResponseSchema);

    expect(fetchedCase).toEqual(createdCase);

    await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail(), creds);
  }, 10000);

  it('should throw an error when the case is not found', async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);
    const client = axios.create();

    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
        region: region,
      },
      creds
    );

    client.interceptors.request.use(interceptor);

    const url = `${deaApiUrl}cases`;
    const caseId = '123bogus';
    const response = await client.get(`${url}/${caseId}`, {
      validateStatus,
    });

    expect(response.status).toEqual(404);
  });
});
