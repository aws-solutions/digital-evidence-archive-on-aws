/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import {
  CognitoSsmParams,
  exchangeAuthorizationCode,
  getCognitoSsmParams,
  getCredentialsByToken,
  getLoginHostedUiUrl,
  revokeRefreshToken,
  useRefreshToken,
} from '../../app/services/auth-service';
import { Oauth2TokenSchema } from '../../models/validation/auth';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../test-e2e/resources/test-helpers';

let cognitoParams: CognitoSsmParams;
let pkceStrings: PkceStrings;
let idToken: string;
let refreshToken: string;

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
    pkceStrings = getPkceStrings();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should return the correct login URL', async () => {
    const loginUrl = await getLoginHostedUiUrl(cognitoParams.callbackUrl);

    expect(loginUrl).toEqual(
      `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`
    );
  }, 40000);

  it('successfully get id token using auth code', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );
    const [tokens] = await exchangeAuthorizationCode(
      authCode,
      pkceStrings.code_verifier,
      undefined,
      authTestUrl
    );

    // Store values for a later test
    idToken = tokens.id_token;
    refreshToken = tokens.refresh_token;

    // Assert if no id token fectched in exchangeAuthorizationCode
    expect(idToken).toBeTruthy();

    const credentials = await getCredentialsByToken(idToken);

    expect(credentials).toHaveProperty('AccessKeyId');
    expect(credentials).toHaveProperty('SecretKey');
    expect(credentials).toHaveProperty('SessionToken');
  }, 40000);

  it('successfully get id token using auth code with an callback override', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser2,
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );
    const [{ id_token }] = await exchangeAuthorizationCode(
      authCode,
      pkceStrings.code_verifier,
      undefined,
      authTestUrl
    );

    // Assert if no id token fectched in exchangeAuthorizationCode
    expect(id_token).toBeTruthy();
  }, 40000);

  it('revoke token should fail when trying to revoke id Token', async () => {
    await expect(revokeRefreshToken(idToken)).rejects.toThrow('Request failed with status code 400');
  }, 40000);

  it('successfully obtain new id token using refresh token. Revoking the token should prevent future use for the refresh token', async () => {
    const [response] = await useRefreshToken(refreshToken);
    Joi.assert(response, Oauth2TokenSchema);

    // now revoke the token
    const revokeResponse = await revokeRefreshToken(refreshToken);
    expect(revokeResponse).toEqual(200);

    // try to use the refresh token again and it should fail
    await expect(useRefreshToken(refreshToken)).rejects.toThrow('Request failed with status code 400');
  }, 60000);

  it('should throw an error if the authorization code is not valid', async () => {
    const dummyAuthCode = 'DUMMY_AUTH_CODE';
    const dummyCodeVerifier = 'DUMMY_PKCE_VERIFIER';
    await expect(exchangeAuthorizationCode(dummyAuthCode, dummyCodeVerifier)).rejects.toThrow(
      'Request failed with status code 400'
    );
  }, 40000);

  it('should throw an error if the id token is not valid', async () => {
    const dummyIdToken = 'DUMMY_ID_TOKEN';
    const dummyCodeChallenge = 'DUMMY_CODE_CHALLENGE';
    await expect(exchangeAuthorizationCode(dummyIdToken, dummyCodeChallenge)).rejects.toThrow(
      'Request failed with status code 400'
    );
  }, 40000);
});
