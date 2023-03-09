/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import { getCognitoSsmParams } from '../../app/services/auth-service';
import { getTokenPayload } from '../../cognito-token-helpers';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPI, callDeaAPIWithCreds, randomSuffix, validateStatus } from '../resources/test-helpers';

describe('API authentication', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = `authE2ETestUser-${randomSuffix()}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  const region = testEnv.awsRegion;
  let creds: Credentials;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', 'Auth', 'Tester');
    [creds] = await cognitoHelper.getCredentialsForUser(testUser);
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should have the DEARole field in the id Token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    const payload = await getTokenPayload(idToken, region);
    expect(payload['custom:DEARole']).toStrictEqual('AuthTestGroup');
  }, 40000);

  it('should allow successful calls to the api for authenticated users', async () => {
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPI(testUser, url, cognitoHelper, 'GET');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('cases');
  }, 40000);

  it('should disallow calls without credentials', async () => {
    const client = axios.create();
    const url = `${deaApiUrl}cases/my-cases`;

    const response = await client.get(url, { validateStatus });
    expect(response.status).toEqual(403);
  });

  it('should disallow calls without id token in the header', async () => {
    const client = axios.create();
    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
        region: region,
      },
      creds
    );
    client.interceptors.request.use(interceptor);

    const url = `${deaApiUrl}cases/my-cases`;

    const response = await client.get(url, { validateStatus });
    expect(response.status).toEqual(400);
  });

  it('should disallow API calls not explicitly allowed by their IAM role', async () => {
    const url = `${deaApiUrl}cases`;

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
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPI(firstTimeFederatedUser, url, cognitoHelper, 'GET');

    expect(response.status).toEqual(200);
  });

  it('should fetch the login url', async () => {
    const client = axios.create();

    // get SSM parameters to compare
    const cognitoParams = await getCognitoSsmParams();
    const expectedUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;

    // fetch url
    const url = `${deaApiUrl}auth/getLoginUrl`;
    const response = await client.get(url);
    expect(response.data).toEqual(expectedUrl);
  });

  it('should ask for an authorization code and exchange for id token', async () => {
    const client = axios.create();

    // 2. Get Auth Code
    const cognitoParams = await getCognitoSsmParams();
    const authCode = await cognitoHelper.getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      cognitoParams.callbackUrl,
      testUser
    );

    // 3. Exchange auth code for id token
    const url = `${deaApiUrl}auth/getToken/${authCode}`;
    const response = await client.post(url, undefined, { validateStatus });
    expect(response.status).toEqual(200);
    const idToken = response.data;

    // 3. Exchange id token for credentials
    const tokenUrl = `${deaApiUrl}auth/getCredentials/${idToken}`;
    const credsResponse = await client.get(tokenUrl, { validateStatus });
    expect(credsResponse.status).toEqual(200);
  }, 40000);

  it('should fail with dummy auth code', async () => {
    const client = axios.create();
    const authCode = 'ABCDEFGHIJKL123';

    const url = `${deaApiUrl}auth/getToken/${authCode}`;
    const response = await client.get(url, { validateStatus });
    expect(response.status).toEqual(403);
    expect(response.statusText).toEqual('Forbidden');
  });

  it('should fail with dummy idToken', async () => {
    const client = axios.create();
    const idToken = 'fake.fake.fake';

    const url = `${deaApiUrl}auth/getCredentials/${idToken}`;
    const response = await client.get(url, { validateStatus });
    expect(response.status).toEqual(500);
    expect(response.statusText).toEqual('Internal Server Error');
  });

  it('should fail when the id token has been modified', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // modify id token to make it invalid
    const replacementIndex = idToken.length / 2;
    const replacementChar = idToken.charAt(replacementIndex) === 'A' ? 'B' : 'A';
    const modifiedToken =
      idToken.substring(0, replacementIndex) + replacementChar + idToken.substring(replacementIndex + 1);

    // Now call DEA with modified token and make sure it fails
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPIWithCreds(url, 'GET', modifiedToken, creds);
    expect(response.status).toEqual(400);
    expect(response.statusText).toEqual('Bad Request');
  }, 40000);

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
