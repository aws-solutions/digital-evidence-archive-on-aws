/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import { CaseStatus } from '../../models/case-status';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { createCaseSuccess, deleteCase, validateStatus } from './test-helpers';

describe('create cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'createCaseTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;
  const region = envSettings.awsRegion;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup');
  });

  afterAll(async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, creds);
    }
    await cognitoHelper.cleanup();
  }, 10000);

  it('should create a new case', async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);

    const caseName = 'CASE B';

    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'this is a description',
      },
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());
  }, 10000);

  it('should give an error when payload is missing', async () => {
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

    const response = await client.post(`${deaApiUrl}cases`, undefined, {
      validateStatus,
    });

    expect(response.status).toEqual(400);
  });

  it('should give an error when the name is in use', async () => {
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

    const caseName = 'CASE C';
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'any description',
      },
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());

    const response = await client.post(
      `${deaApiUrl}cases`,
      {
        name: caseName,
        status: 'ACTIVE',
        description: 'any description',
      },
      {
        validateStatus,
      }
    );

    expect(response.status).toEqual(500);
  }, 10000);
});
