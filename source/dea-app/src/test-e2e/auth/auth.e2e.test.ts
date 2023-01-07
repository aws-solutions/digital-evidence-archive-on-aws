/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';

describe('API authentication', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'authE2ETestUser';
  const deaApiUrl = envSettings.apiUrlOutput;
  const region = envSettings.awsRegion;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should allow successful calls to the api for authenticated users', async () => {
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
  }, 10000);

  it('should disallow calls without credentials', async () => {
    const client = axios.create();
    const url = `${deaApiUrl}hi`;

    expect(client.get(url)).rejects.toThrow('Request failed with status code 403');
  });

  it('should disallow API calls not explicitly allowed by their IAM role', async () => {
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

  it('should log successful and unsuccessful logins/api invocations', () => {
    /* TODO */
  });

  it('should disallow concurrent active session', () => {
    /* TODO */
    // check after first session has been invalidated, you cannot use the credentials again
  });

  it('should require reauthentication about 30 minutes of inactivity', () => {
    /* TODO */
  });
});
