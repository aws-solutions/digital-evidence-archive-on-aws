/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import { getCognitoSsmParams } from '../../app/services/auth-service';
import { getTokenPayload } from '../../cognito-token-helpers';
import { Oauth2Token } from '../../models/auth';
import { getAuthorizationCode } from '../helpers/auth-helper';
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
    const url = `${deaApiUrl}auth/loginUrl`;
    const response = await client.get(url, { validateStatus });
    expect(response.data).toEqual(expectedUrl);
  });

  it('should ask for an authorization code and exchange for id token', async () => {
    const client = axios.create();

    // 2. Get Auth Code
    const cognitoParams = await getCognitoSsmParams();

    // Get test auth code page
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword
    );

    // 3. Exchange auth code for id token
    const url = `${deaApiUrl}auth/${authCode}/token`;
    const headers = { 'callback-override': authTestUrl };
    const response = await client.post(url, undefined, { headers, validateStatus });
    expect(response.status).toEqual(200);
    const retrievedTokens: Oauth2Token = response.data;
    const idToken = retrievedTokens.id_token;

    // 3. Exchange id token for credentials
    const credentialsUrl = `${deaApiUrl}auth/credentials/${idToken}/exchange`;
    const credsResponse = await client.get(credentialsUrl, { validateStatus });
    expect(credsResponse.status).toEqual(200);
  }, 40000);

  it('should fail with dummy auth code', async () => {
    const client = axios.create();
    const authCode = 'ABCDEFGHIJKL123';

    const url = `${deaApiUrl}auth/${authCode}/token`;
    const response = await client.get(url, { validateStatus });
    expect(response.status).toEqual(403);
    expect(response.statusText).toEqual('Forbidden');
  });

  it('should fail with dummy idToken', async () => {
    const client = axios.create();
    const idToken = 'fake.fake.fake';

    const url = `${deaApiUrl}auth/credentials/${idToken}/exchange`;
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

  // TODO (next PR) uncomment after you mark session as revoked in /refresh endpoint
  // it('should successfully revoke refresh token', async () => {
  //   const [creds, idToken, refreshToken] = await cognitoHelper.getCredentialsForUser(testUser);

  //   const payload: RevokeToken = {
  //     refreshToken: refreshToken,
  //   };

  //   const url = `${deaApiUrl}auth/revokeToken`;
  //   const response = await callDeaAPIWithCreds(url, 'POST', idToken, creds, payload);

  //   expect(response.data).toEqual(200);
  // }, 40000);

  it('should disallow concurrent active session', async () => {
    // Create user
    const user = 'ConcurrentUserE2ETest';
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'ConcurrentE2E', 'AuthTester');

    // Get credentials
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(user);

    // Make successful API call
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPIWithCreds(url, 'GET', idToken, creds);
    expect(response.status).toEqual(200);

    // Get new credentials
    const newCreds = await cognitoHelper.getCredentialsForUser(user);
    // Call API with new credentials, see that it fails with ReAuthentication error
    const failed = await callDeaAPIWithCreds(url, 'GET', newCreds[1], newCreds[0]);
    expect(failed.status).toEqual(412);

    // TODO: (next PR) Finish rest of the test after you mark session as revoked in /logout endpoint
    // Call logout on original credentials
    // Call API with second set of credentials, see that it succeeds
  }, 40000);

  // TODO: Once we have tests that we only run once ever 24 hours, add this
  // test to that, since it would add 30 minutes to every run. Other tests like
  // this would be archive/restore tests.
  // it('should require reauthentication about 30 minutes of inactivity', async () => {
  //   // Create user
  //   const user = "InactiveSessionE2ETest"
  //   await cognitoHelper.createUser(user, 'AuthTestGroup', 'InactiveSession', 'AuthTester');

  //   // Get credentials
  //   const [creds, idToken] = await cognitoHelper.getCredentialsForUser(user);

  //   // Make successful API call
  //   const url = `${deaApiUrl}cases/my-cases`;
  //   const response = await callDeaAPIWithCreds(url, 'GET', idToken, creds);
  //   expect(response.status).toEqual(200);

  //   // Now sleep for 35 minutes to check inactivity timeout
  //   const sleepIncrements = 6;
  //   const sleepIncrementTime = Math.ceil(30 / sleepIncrements);
  //   console.log("Sleeping for 30 minutes to check session lock after 30 minutes of inactivity...");
  //   for(let i = 0; i < sleepIncrements; i++) {
  //     await new Promise((r) => setTimeout(r, sleepIncrementTime * 60000));
  //     console.log(`${(i + 1) * sleepIncrementTime}/30 minutes complete...`);
  //   }

  //   // Now call with same creds, see that it fails due to inactivity
  //   const failed = await callDeaAPIWithCreds(url, 'GET', idToken, creds);
  //   expect(failed.status).toEqual(412);
  // }, 3600000);

  it('should log successful and unsuccessful logins/api invocations', async () => {
    /* TODO */
  });
});
