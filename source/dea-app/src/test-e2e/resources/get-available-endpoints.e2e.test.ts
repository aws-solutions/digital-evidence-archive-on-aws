/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Credentials } from 'aws4-axios';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, randomSuffix } from './test-helpers';

interface AvailableEndpointsBody {
  endpoints: string[];
}

describe('get available endpoints E2E', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix();
  const testUser = `getEndpointsUser${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;

  let creds: Credentials;
  let idToken: Oauth2Token;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'NoPermissionsGroup', 'getEndpoints', 'TestUser');

    const credentials = await cognitoHelper.getCredentialsForUser(testUser);
    creds = credentials[0];
    idToken = credentials[1];
    // Call an api to add this user to the DB
    await callDeaAPIWithCreds(`${deaApiUrl}availableEndpoints`, 'GET', idToken, creds);
  }, 30000);

  afterAll(async () => {
    await cognitoHelper.cleanup();
  }, 30000);

  it('should return available endpoints for a requesting user', async () => {
    const response = await callDeaAPIWithCreds(`${deaApiUrl}availableEndpoints`, 'GET', idToken, creds);

    expect(response.status).toEqual(200);
    const payload: AvailableEndpointsBody = response.data;

    expect(payload.endpoints).toHaveLength(1);
    expect(payload.endpoints).toContain('/availableEndpointsGET');
  }, 20000);
});
