/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  exchangeAuthorizationCode,
  getCognitoSsmParams,
  CognitoSsmParams,
  getCredentialsByToken,
  getLoginHostedUiUrl,
} from '../../app/services/auth-service';
import CognitoHelper from '../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../test-e2e/resources/test-helpers';

let cognitoParams: CognitoSsmParams;

describe('auth service', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `authServiceIntegrationTestUser${suffix}`;
  const testUser2 = `authServiceIntegrationTestUser2${suffix}`;
  const firstName = 'authServiceHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    await cognitoHelper.createUser(testUser2, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should return the correct login URL', async () => {
    const loginUrl = await getLoginHostedUiUrl();

    expect(loginUrl).toEqual(
      `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`
    );
  });

  it('successfully get id token using auth code', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await cognitoHelper.getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser
    );
    const idToken = await exchangeAuthorizationCode(authCode, undefined, authTestUrl);

    // Assert if no id token fectched in exchangeAuthorizationCode
    expect(idToken).toBeTruthy();

    const credentials = await getCredentialsByToken(idToken);

    expect(credentials).toHaveProperty('AccessKeyId');
    expect(credentials).toHaveProperty('SecretKey');
    expect(credentials).toHaveProperty('SessionToken');
  }, 20000);

  it('successfully get id token using auth code with an origin', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await cognitoHelper.getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser2
    );
    let origin = cognitoParams.callbackUrl.substring(0, cognitoParams.callbackUrl.lastIndexOf('/')); //remove /login
    origin = origin.substring(0, origin.lastIndexOf('/')); //remove /ui
    origin = origin.substring(0, origin.lastIndexOf('/')); //remove stage
    const idToken = await exchangeAuthorizationCode(authCode, origin);

    // Assert if no id token fectched in exchangeAuthorizationCode
    expect(idToken).toBeTruthy();
  }, 20000);

  it('should throw an error if the authorization code is not valid', async () => {
    const dummyAuthCode = 'DUMMY_AUTH_CODE';
    await expect(exchangeAuthorizationCode(dummyAuthCode)).rejects.toThrow(
      'Request failed with status code 400'
    );
  });

  it('should throw an error if the id token is not valid', async () => {
    const dummyIdToken = 'DUMMY_ID_TOKEN';
    await expect(exchangeAuthorizationCode(dummyIdToken)).rejects.toThrow(
      'Request failed with status code 400'
    );
  });
});
