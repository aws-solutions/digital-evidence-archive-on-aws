/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import { aws4Interceptor } from "aws4-axios";
import axios from "axios";
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { caseSchema } from '../../models/validation/case';
import CognitoHelper from "../helpers/cognito-helper";
import Setup from "../helpers/setup";
import { deleteCase } from './test-helpers';

describe('get case api', () => {
  const setup: Setup = new Setup();
  const cognitoHelper: CognitoHelper = new CognitoHelper(setup);

  const testUser = 'getCaseE2ETestUser';
  const deaApiUrl = setup.getSettings().get('apiUrlOutput');
  const region = setup.getSettings().get('awsRegion');

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'GetCaseTestGroup');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should get a created case', async () => {
    const creds = (await cognitoHelper.getCredentialsForUser(testUser));
    const client = axios.create();

    const interceptor = aws4Interceptor({
        service: "execute-api",
        region: region,
    }, creds);

    client.interceptors.request.use(interceptor);

    // Create Case
    const caseName = 'caseWithDetails';
    const url = `${deaApiUrl}cases`;
    const response = await client.post(url, {
      name: caseName,
      status: 'ACTIVE',
      description: 'this is a description',
    });

    expect(response.status).toBeTruthy();

    //eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const createdCase = (await response.data) as DeaCase;
    Joi.assert(createdCase, caseSchema);
    expect(createdCase.name).toEqual(caseName);

    // Now call Get and Check response is what we created
    const getResponse = await client.get(`${url}/${createdCase.ulid}`);

    expect(getResponse.status).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCase = (await response.data) as DeaCase;
    Joi.assert(fetchedCase, caseSchema);

    expect(fetchedCase).toEqual(createdCase);

    await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail(), creds, region);
  }, 10000);

    it('should throw an error when the case is not found', async () => {
      const creds = (await cognitoHelper.getCredentialsForUser(testUser));
      const client = axios.create();
  
      const interceptor = aws4Interceptor({
          service: "execute-api",
          region: region,
      }, creds);
  
      client.interceptors.request.use(interceptor);

      const url = `${deaApiUrl}cases`;
      const caseId = '123bogus';
      expect(client.get(`${url}/${caseId}`)).rejects.toThrow('Request failed with status code 404');
    });
});
