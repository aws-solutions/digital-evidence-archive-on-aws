/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getCredentials } from '../../../app/resources/get-credentials';
import { getToken } from '../../../app/resources/get-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../../../test-e2e/helpers/auth-helper';

import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { dummyContext, getDummyEvent, setCookieToCookie } from '../../integration-objects';

let cognitoParams: CognitoSsmParams;
let pkceStrings: PkceStrings;

describe('get-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'authCodeIntegrationTestUser';
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
    pkceStrings = getPkceStrings();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('successfully get id token using auth code', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );

    const event = getDummyEvent({
      body: JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      pathParameters: {
        authCode: authCode,
      },
      headers: {
        'callback-override': authTestUrl,
      },
    });

    const response = await getToken(event, dummyContext);
    expect(response.statusCode).toEqual(200);

    if (!response.headers) {
      fail();
    }

    const credentialsEvent = getDummyEvent({
      headers: {
        cookie: setCookieToCookie(response),
      },
    });

    const credsRepsonse = await getCredentials(credentialsEvent, dummyContext);
    if (!credsRepsonse.body) {
      fail();
    }
    const credentials = JSON.parse(credsRepsonse.body);
    expect(credentials).toHaveProperty('AccessKeyId');
    expect(credentials).toHaveProperty('SecretKey');
    expect(credentials).toHaveProperty('SessionToken');
  }, 20000);

  it('should throw an error if the authorization code is not valid', async () => {
    const event = getDummyEvent({
      body: JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      pathParameters: {
        authCode: 'DUMMYAUTHCODE',
      },
    });

    await expect(getToken(event, dummyContext)).rejects.toThrow('Request failed with status code 400');
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getToken(getDummyEvent(), dummyContext)).rejects.toThrow(ValidationError);
  });
});
