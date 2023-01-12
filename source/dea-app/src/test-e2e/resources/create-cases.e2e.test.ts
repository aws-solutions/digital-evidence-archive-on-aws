/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { caseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import Setup from '../helpers/setup';
import { deleteCase } from './test-helpers';

describe('create cases api', () => {
  const setup: Setup = new Setup();
  const cognitoHelper: CognitoHelper = new CognitoHelper(setup);

  const testUser = 'createCaseTestUser';
  const deaApiUrl = setup.getSettings().get('apiUrlOutput');
  const region = setup.getSettings().get('awsRegion');

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup');
  });

  afterAll(async () => {
    const creds = await cognitoHelper.getCredentialsForUser(testUser);
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl ?? fail(), caseId, creds, region);
    }
    await cognitoHelper.cleanup();
  });

  it('should create a new case', async () => {
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

    const caseName = 'CASE B';
    const url = `${deaApiUrl}cases`;

    const response = await client.post(url, {
      name: caseName,
      status: 'ACTIVE',
      description: 'this is a description',
    });

    expect(response.status).toBeTruthy();

    //eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const jsonResp = (await response.data) as DeaCase;
    Joi.assert(jsonResp, caseSchema);

    expect(jsonResp.name).toEqual(caseName);
    caseIdsToDelete.push(jsonResp.ulid ?? fail());
  }, 10000);

  // TODO: refactor this test
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

    expect(client.post(`${deaApiUrl}cases`)).rejects.toThrow('Request failed with status code 400');
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
    const response = await client.post(`${deaApiUrl}cases`, {
      name: caseName,
      status: 'ACTIVE',
      description: 'any description',
    });

    expect(response.status).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const jsonResp = (await response.data) as DeaCase;
    Joi.assert(jsonResp, caseSchema);

    caseIdsToDelete.push(jsonResp.ulid ?? fail());

    expect(
      client.post(`${deaApiUrl}cases`, {
        name: caseName,
        status: 'ACTIVE',
        description: 'any description',
      })
    ).rejects.toThrow('Request failed with status code 500');
  }, 10000);
});
