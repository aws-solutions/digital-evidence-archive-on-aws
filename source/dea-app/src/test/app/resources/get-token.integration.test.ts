/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getToken } from '../../../app/resources/get-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/parameter-service';
import { defaultCacheProvider } from '../../../storage/cache';
import { defaultParametersProvider } from '../../../storage/parameters';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';

let cognitoParams: CognitoSsmParams;
let pkceStrings: PkceStrings;

describe('get-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();
  const OLD_ENV = process.env;

  const suffix = randomSuffix(5);
  const testUser = `authCodeIntegrationTestUser${suffix}`;
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams(defaultParametersProvider, defaultCacheProvider);
    pkceStrings = getPkceStrings();
  });

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.SAMESITE = 'Strict';
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
    process.env = OLD_ENV;
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

    if (!response.multiValueHeaders) {
      fail();
    }
  }, 20000);

  it('should throw a validation error if the authorization code is not valid', async () => {
    const event = getDummyEvent({
      body: JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      pathParameters: {
        authCode: 'DUMMYAUTHCODE',
      },
    });

    await expect(getToken(event, dummyContext)).rejects.toThrow(ValidationError);
  });

  it('should throw a validation error if the codeVerifier is not valid', async () => {
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
        codeVerifier: 'DUMMYCODE_VERIFIER',
      }),
      pathParameters: {
        authCode: authCode,
      },
    });

    await expect(getToken(event, dummyContext)).rejects.toThrow(ValidationError);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getToken(getDummyEvent(), dummyContext)).rejects.toThrow(ValidationError);
  });
});
