/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor } from 'aws4-axios';
import axios, { AxiosError } from 'axios';
import { getCognitoSsmParams } from '../../app/services/auth-service';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPI } from '../resources/test-helpers';

let idToken: string;

describe('API authentication', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'authE2ETestUser';
  const deaApiUrl = testEnv.apiUrlOutput;
  const region = testEnv.awsRegion;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', 'Auth', 'Tester');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should allow successful calls to the api for authenticated users', async () => {
    const url = `${deaApiUrl}hi`;
    const response = await callDeaAPI(testUser, url, cognitoHelper, 'GET');

    expect(response.status).toBe(200);
    expect(response.data).toBe('Hello DEA!');
  }, 30000);

  it('should disallow calls without credentials', async () => {
    const client = axios.create();
    const url = `${deaApiUrl}hi`;

    await expect(client.get(url)).rejects.toThrow('Request failed with status code 403');
  });

  it('should disallow calls without id token in the header', async () => {
    const [creds] = await cognitoHelper.getCredentialsForUser(testUser);

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

    await expect(client.get(url)).rejects.toThrow('Request failed with status code 400');
    // const response = await client.get(url);

    // expect(response.status).toEqual(400);
  });

  it('should disallow API calls not explicitly allowed by their IAM role', async () => {
    const url = `${deaApiUrl}cases`;
    //expect(callDeaAPI(testUser, url, cognitoHelper, "GET")).rejects.toThrow('Request failed with status code 403');

    const response = await callDeaAPI(testUser, url, cognitoHelper, 'GET');
    expect(response.status).toEqual(403);
  });

  it('should add first time federated user to DDB', async () => {
    // 1. create user
    const firstTimeFederatedUser = 'CheckFirstTimeFederatedUserTestUser';
    const firstName = 'CheckFirstTimeFederatedUser';
    const lastName = 'TestUser';
    await cognitoHelper.createUser(firstTimeFederatedUser, 'AuthTestGroup', firstName, lastName);

    // 3. call hi
    const url = `${deaApiUrl}hi`;
    const response = await callDeaAPI(firstTimeFederatedUser, url, cognitoHelper, 'GET');

    expect(response.status).toEqual(200);
  });

  it('should ask for an authorization code and exchange for id token', async () => {
    const client = axios.create();

    // 1. create user
    const authCodeUser = 'authCodeLoginUser';
    const firstName = 'authCodeLoginUser';
    const lastName = 'TestUser';
    await cognitoHelper.createUser(authCodeUser, 'AuthTestGroup', firstName, lastName);

    // 2. Get Auth Code
    const [cognitoDomain, , callbackUrl] = await getCognitoSsmParams();
    const authCode = await cognitoHelper.getAuthorizationCode(cognitoDomain, callbackUrl, testUser);

    // 3. Exchange auth code for id token
    const url = `${deaApiUrl}auth/getToken/${authCode}`;
    const response = await client.post(url);
    idToken = response.data;
    expect(response.status).toEqual(200);
  }, 20000);

  it('should fail with dummy auth code', async () => {
    const client = axios.create();
    const authCode = 'ABCDEFGHIJKL123';

    const url = `${deaApiUrl}auth/getToken/${authCode}`;
    await expect(client.post(url)).rejects.toThrow(AxiosError);
  });

  it('should exchange id Token for credentials', async () => {
    const client = axios.create();

    // 3. Exchange id token for credentials
    const url = `${deaApiUrl}auth/getCredentials/${idToken}`;
    const response = await client.get(url);
    expect(response.status).toEqual(200);
  });

  it('should fail with dummy idToken', async () => {
    const client = axios.create();
    const idToken = 'ABCDEFGHIJKL123';

    const url = `${deaApiUrl}auth/getCredentials/${idToken}`;
    await expect(client.get(url)).rejects.toThrow(AxiosError);
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
