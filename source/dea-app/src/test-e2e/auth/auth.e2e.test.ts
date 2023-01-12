/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import CognitoHelper from '../helpers/cognito-helper';
import Setup from '../helpers/setup';

describe('API authentication', () => {
  const setup: Setup = new Setup();
  const cognitoHelper: CognitoHelper = new CognitoHelper(setup);

  const testUser = 'authE2ETestUser';
  const deaApiUrl = setup.getSettings().get('apiUrlOutput');
  const region = setup.getSettings().get('awsRegion');

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('Positive Tests: User CAN call APIs as defined by the IAM Role', async () => {
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

    const url = `${deaApiUrl}hi`;
    const response = await client.get(url);

    expect(response.status).toBeTruthy();
    expect(response.data).toBe('Hello DEA!');
  });

  it('Negative tests: Unauthenticated user (no creds) cannot access DEA', async () => {
    const client = axios.create();
    const url = `${deaApiUrl}hi`;

    expect(client.get(url)).rejects.toThrow('Request failed with status code 403');
  });

  it('Negative tests: User cannot access APIs outside their IAM role', async () => {
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
    expect(client.get(url)).rejects.toThrow('Request failed with status code 403');
  });

  it('Verify Audit logs shows successful and unsuccessful logins/api invocations', () => {
    /* TODO */
  });

  it('Verify concurrent active session fails', () => {
    /* TODO */
    // check after first session has been invalidated, you cannot use the credentials again
  });

  it('Verify session lock', () => {
    /* TODO */
  });
});
