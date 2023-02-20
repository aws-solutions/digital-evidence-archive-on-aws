/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  exchangeAuthorizationCode,
  getCognitoSsmParams,
  CognitoSsmParams,
  getCredentialsByToken,
  decodeTokenForUsername,
} from '../../app/services/auth-service';
import CognitoHelper from '../../test-e2e/helpers/cognito-helper';

let cognitoParams: CognitoSsmParams;
let idToken: string;

describe('cognito helpers integration test', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'authServiceIntegrationTestUser';
  const firstName = 'authServiceHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('successfully get id token using auth code', async () => {
    const authCode = await cognitoHelper.getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      cognitoParams.callbackUrl,
      testUser
    );
    idToken = await exchangeAuthorizationCode(authCode);

    // Assert if no id token fectched in exchangeAuthorizationCode
    expect(idToken).toBeTruthy();
  }, 20000);

  it('successfully decodes id token for user name', async () => {
    const userName = decodeTokenForUsername(idToken);
    expect(userName).toEqual(testUser);
  });

  it('should throw an error if given dummy id token', async () => {
    try {
      decodeTokenForUsername('dummyIdToken');
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect((error as Error).message).toStrictEqual('Invalid Token');
    }
  });

  it('should throw an error if the authorization code is not valid', async () => {
    const dummyAuthCode = 'DUMMY_AUTH_CODE';
    await expect(exchangeAuthorizationCode(dummyAuthCode)).rejects.toThrow(
      'Request failed with status code 400'
    );
  });

  it('should succesfully fetch IAM credentials', async () => {
    const credentials = await getCredentialsByToken(idToken);

    expect(credentials).toHaveProperty('AccessKeyId');
    expect(credentials).toHaveProperty('SecretKey');
    expect(credentials).toHaveProperty('SessionToken');
  });

  it('should throw an error if the id token is not valid', async () => {
    const dummyIdToken = 'DUMMY_ID_TOKEN';
    await expect(exchangeAuthorizationCode(dummyIdToken)).rejects.toThrow(
      'Request failed with status code 400'
    );
  });
});
