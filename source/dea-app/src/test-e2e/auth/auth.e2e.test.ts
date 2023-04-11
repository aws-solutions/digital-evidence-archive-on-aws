/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { AdminGetUserResponse } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import _ from 'lodash';
import { getCognitoSsmParams } from '../../app/services/auth-service';
import { getTokenPayload } from '../../cognito-token-helpers';
import { Oauth2Token } from '../../models/auth';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../helpers/auth-helper';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPI, callDeaAPIWithCreds, randomSuffix, validateStatus } from '../resources/test-helpers';

let pkceStrings: PkceStrings;

describe('API authentication', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = `authE2ETestUser-${randomSuffix()}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  const region = testEnv.awsRegion;
  const stage = testEnv.stage;
  let creds: Credentials;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', 'Auth', 'Tester');
    [creds] = await cognitoHelper.getCredentialsForUser(testUser);
    pkceStrings = getPkceStrings();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should have the DEARole field in the id Token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    const payload = await getTokenPayload(idToken.id_token, region);
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
    let expectedUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
    // If you have an external IdP integrated, then DEA uses
    // the identity_provider query param to redirect automatically
    // to the IdP from the Hosted UI
    if (cognitoParams.agencyIdpName) {
      expectedUrl += `&identity_provider=${cognitoParams.agencyIdpName}`;
    }

    // fetch url
    const url = `${deaApiUrl}auth/loginUrl?callbackUrl=${cognitoParams.callbackUrl}`;
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
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );

    // 3. Exchange auth code for id token
    const url = `${deaApiUrl}auth/${authCode}/token`;
    const headers = { 'callback-override': authTestUrl };
    const response = await client.post(
      url,
      JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      { headers, validateStatus }
    );
    expect(response.status).toEqual(200);
    const retrievedTokens: Oauth2Token = response.data;
    const idToken = retrievedTokens.id_token;

    // 3. Exchange id token for credentials
    const credentialsUrl = `${deaApiUrl}auth/credentials/${idToken}/exchange`;
    const credsResponse = await client.get(credentialsUrl, { validateStatus });
    expect(credsResponse.status).toEqual(200);
  }, 60000);

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
    const replacementIndex = idToken.id_token.length / 2;
    const replacementChar = idToken.id_token.charAt(replacementIndex) === 'A' ? 'B' : 'A';
    const modifiedToken =
      idToken.id_token.substring(0, replacementIndex) +
      replacementChar +
      idToken.id_token.substring(replacementIndex + 1);

    const modifiedOauth = _.cloneDeep({
      ...idToken,
      id_token: modifiedToken,
    });

    // Now call DEA with modified token and make sure it fails
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPIWithCreds(url, 'GET', modifiedOauth, creds);
    expect(response.status).toEqual(400);
    expect(response.statusText).toEqual('Bad Request');
  }, 40000);

  it('should successfully revoke refresh token', async () => {
    // Create user
    const user = 'RevokeTokenE2ETest';
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'RevokeTokenE2E', 'AuthTester');

    // Get credentials
    const [creds, oauthToken] = await cognitoHelper.getCredentialsForUser(user);

    // Make api call (adds session to database)
    const url = `${deaApiUrl}cases/my-cases`;
    const response1 = await callDeaAPIWithCreds(url, 'GET', oauthToken, creds);
    expect(response1.status).toEqual(200);

    // revoke token
    const revokeUrl = `${deaApiUrl}auth/revokeToken`;
    const response = await callDeaAPIWithCreds(revokeUrl, 'POST', oauthToken, creds, undefined);
    expect(response.data).toEqual(200);

    // Try to make API call with the token, it should fail
    const response2 = await callDeaAPIWithCreds(url, 'GET', oauthToken, creds);
    expect(response2.status).toEqual(412); // Reauthentication error

    const refreshUrl = `${deaApiUrl}auth/refreshToken`;
    const failedRefresh = await callDeaAPIWithCreds(refreshUrl, 'POST', oauthToken, creds, undefined);
    expect(failedRefresh.status).toEqual(412);

    // Get new credentials, make api call should pass immediately since old session is marked as revoked
    const [creds1, idToken1] = await cognitoHelper.getCredentialsForUser(user);
    const response3 = await callDeaAPIWithCreds(url, 'GET', idToken1, creds1);
    expect(response3.status).toEqual(200);
  }, 40000);

  it('should successfully use refresh token for a new idtoken', async () => {
    // Create user
    const user = 'RefreshTokenE2ETest';
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'RefreshTokenE2E', 'AuthTester');

    // Get credentials
    const [creds, oauthToken] = await cognitoHelper.getCredentialsForUser(user);

    // Make api call (adds session to database)
    const url = `${deaApiUrl}cases/my-cases`;
    const response1 = await callDeaAPIWithCreds(url, 'GET', oauthToken, creds);
    expect(response1.status).toEqual(200);

    const refreshUrl = `${deaApiUrl}auth/refreshToken`;
    const refreshResponse = await callDeaAPIWithCreds(refreshUrl, 'POST', oauthToken, creds, undefined);
    expect(refreshResponse.status).toEqual(200);
    const newIdToken = await refreshResponse.data.idToken;

    // Try to make API call with the old token, it should fail
    const response2 = await callDeaAPIWithCreds(url, 'GET', oauthToken, creds);
    expect(response2.status).toEqual(412); // Reauthentication error

    // call API with the new token
    const response3 = await callDeaAPIWithCreds(url, 'GET', newIdToken, creds);
    expect(response3.status).toEqual(200);
  }, 40000);

  it.only('should disallow concurrent active session', async () => {
    // Create user
    const user = 'ConcurrentUserE2ETest';
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'ConcurrentE2E', 'AuthTester');

    // Get credentials
    const [creds, oauthToken] = await cognitoHelper.getCredentialsForUser(user);

    // Make successful API call
    const url = `${deaApiUrl}cases/my-cases`;
    const response = await callDeaAPIWithCreds(url, 'GET', oauthToken, creds);
    expect(response.status).toEqual(200);

    // Get new credentials
    const [creds1, idToken1] = await cognitoHelper.getCredentialsForUser(user);
    // Call API with new credentials, see that it fails with ReAuthentication error
    const failed = await callDeaAPIWithCreds(url, 'GET', idToken1, creds1);
    expect(failed.status).toEqual(412); // Reauthentication error

    const revokeUrl = `${deaApiUrl}auth/revokeToken`;
    const revokeResponse = await callDeaAPIWithCreds(revokeUrl, 'POST', oauthToken, creds, undefined);
    expect(revokeResponse.data).toEqual(200);

    // Call API with second set of credentials, see that it succeeds
    const response1 = await callDeaAPIWithCreds(url, 'GET', idToken1, creds1);
    expect(response1.status).toEqual(200);
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

  // This test will ONLY run in you have an external idp linked up to Cognito, (with
  // the appropriate attribute mapping)
  // whose name (recognized by Cognito) is stored in SSM Param Store under
  // /dea/<region>/<stage>-agency-idp-name, AND have a test user ALREADY created
  // in the IdP (assigned to the DEA application under test and has DEARole assigned as CaseWorker)
  // whose login credentials are stored in SSM Param store under
  // /dea/<region>/<stage>-test/idp/idp-test-user-logon and /dea/<region>/<stage>-test/idp/idp-test-user-password
  // you can use the following script in the dea-app folder to set those fields in SSM
  // "rushx idp-test-setup --username <TEST_USER_NAME> --password <TEST_USER_PASSWORD>"
  it('should authenticate and authorize a federated user from the configured IdP', async () => {
    // Check that SSM Parameters are all present, if not skip the test
    const ssmClient = new SSMClient({ region });
    const agencyIdpNamePath = `/dea/${region}/${stage}-agency-idp-name`;
    const testUserLogonPath = `/dea/${region}/${stage}-test/idp/idp-test-user-logon`;
    const testUserPasswordPath = `/dea/${region}/${stage}-test/idp/idp-test-user-password`;
    const ssmResponse = await ssmClient.send(
      new GetParametersCommand({
        Names: [agencyIdpNamePath, testUserLogonPath, testUserPasswordPath],
      })
    );

    if (
      !ssmResponse.Parameters ||
      ssmResponse.Parameters.length != 3 ||
      !ssmResponse.Parameters[0].Value ||
      !ssmResponse.Parameters[1].Value ||
      !ssmResponse.Parameters[2].Value
    ) {
      console.warn(
        'Skipping IdP E2E test, because external IdP is not integrated OR test user fields are not set.'
      );
      return;
    }

    // Parse the response into variables
    let agencyIdpName;
    let testUserLogon;
    let testUserPassword;
    ssmResponse.Parameters.forEach((param) => {
      switch (param.Name) {
        case agencyIdpNamePath:
          agencyIdpName = param.Value;
          break;
        case testUserLogonPath:
          testUserLogon = param.Value;
          break;
        case testUserPasswordPath:
          testUserPassword = param.Value;
          break;
        default:
          throw new Error('Error when parsing external IdP/test user information');
      }
    });

    if (!agencyIdpName || !testUserLogon || !testUserPassword) {
      throw new Error('Error when parsing external IdP/test user information');
    }

    // Delete user in Cognito Pool to test first time federation
    // so we can test that the attribute mapping works as expected
    const testUserCognitoUserName = `${agencyIdpName}_${testUserLogon}`;
    const doesUserExist = await cognitoHelper.doesUserExist(testUserCognitoUserName);
    if (doesUserExist) {
      console.info(
        'External IdP test user already exists in Cognito, deleting user to test first time attribute mapping.'
      );
      await cognitoHelper.deleteUser(testUserCognitoUserName);
    }

    // Use Hosted UI to federate user and get auth code
    const cognitoParams = await getCognitoSsmParams();
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');
    let authCode: string | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        authCode = await getAuthorizationCode(
          cognitoParams.cognitoDomainUrl,
          authTestUrl,
          testUserLogon,
          testUserPassword,
          pkceStrings.code_challenge,
          agencyIdpName
        );

        if (authCode) {
          break;
        }
      } catch (e) {
        console.log('Failed to grab auth code, retrying...');
      }
    }

    if (!authCode) {
      throw new Error('Failed to retrieve auth code.');
    }

    // Query Cognito to describe user, expect user's attributes to have
    // been created correctly
    const user = await cognitoHelper.getUser(testUserCognitoUserName);
    if (!user) {
      throw new Error('User was not created in the user pool after federation');
    }
    if (!user.UserAttributes) {
      throw new Error('Unable to get user attributes.');
    }
    function verifyUserAttr(user: AdminGetUserResponse, fieldName: string, expectedValue: string) {
      const value = user.UserAttributes?.find((attr) => attr.Name === fieldName);
      expect(value?.Value).toStrictEqual(expectedValue);
    }
    verifyUserAttr(user, 'email', testUserLogon);
    verifyUserAttr(user, 'preferred_username', testUserLogon);
    verifyUserAttr(user, 'custom:DEARole', 'CaseWorker');
    // Verify the first and last names are set
    expect(user.UserAttributes.find((attr) => attr.Name === 'family_name')).toBeDefined();
    expect(user.UserAttributes.find((attr) => attr.Name === 'given_name')).toBeDefined();
    // Check that a sub was defined (we use this in the db to check whether the user was added to db or not)
    expect(user.UserAttributes.find((attr) => attr.Name === 'sub')).toBeDefined();

    // Exchange auth code for id token
    const client = axios.create();
    const url = `${deaApiUrl}auth/${authCode}/token`;
    const headers = { 'callback-override': authTestUrl };
    const tokenResponse = await client.post(
      url,
      JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      { headers, validateStatus }
    );
    expect(tokenResponse.status).toEqual(200);
    const retrievedTokens: Oauth2Token = tokenResponse.data;
    const idToken = retrievedTokens.id_token;

    // Confirm IdToken has the correct fields
    const payload = await getTokenPayload(idToken, region);
    expect(payload['custom:DEARole']).toStrictEqual('CaseWorker');
    expect(payload['family_name']).toBeDefined();
    expect(payload['given_name']).toBeDefined();
    expect(payload.sub).toBeDefined();

    // Exchange id token for credentials
    const credentialsUrl = `${deaApiUrl}auth/credentials/${idToken}/exchange`;
    const credsResponse = await client.get(credentialsUrl, { validateStatus });
    expect(credsResponse.status).toEqual(200);

    // Call a CaseWorker API, expect success
    const response = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', retrievedTokens, creds);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('cases');

    // Call an Evidence Manager API, expect failure
    const failed = await callDeaAPIWithCreds(`${deaApiUrl}cases/all-cases`, 'GET', retrievedTokens, creds);
    expect(failed.status).toEqual(403);
  }, 60000);
});
