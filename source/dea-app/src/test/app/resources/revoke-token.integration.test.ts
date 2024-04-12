/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getToken } from '../../../app/resources/get-token';
import { refreshToken } from '../../../app/resources/refresh-token';
import { revokeToken } from '../../../app/resources/revoke-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/parameter-service';
import { Oauth2Token } from '../../../models/auth';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { defaultCacheProvider } from '../../../storage/cache';
import { defaultParametersProvider } from '../../../storage/parameters';
import { PkceStrings, getAuthorizationCode, getPkceStrings } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../../test-e2e/resources/test-helpers';
import {
  createTestProvidersObject,
  dummyContext,
  getDummyEvent,
  setCookieToCookie,
} from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let cognitoParams: CognitoSsmParams;
let repositoryProvider: ModelRepositoryProvider;
let pkceStrings: PkceStrings;

describe('revoke-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();
  const testProviders = createTestProvidersObject({});

  const suffix = randomSuffix(5);
  const testUser = `RevokeCodeIntegrationTestUser${suffix}`;
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.SAMESITE = 'Strict';
  });

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams(defaultParametersProvider, defaultCacheProvider);
    repositoryProvider = await getTestRepositoryProvider('revokeTokenTest');
    pkceStrings = getPkceStrings();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
    process.env = OLD_ENV;
  });

  it('successfully revoke an refresh token', async () => {
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

    const response = await getToken(event, dummyContext, testProviders);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const dummyEvent = getDummyEvent({
      headers: { cookie: setCookieToCookie(response) },
    });

    // revoke token (marks session as revoked)
    const revokeResponse = await revokeToken(dummyEvent, dummyContext, testProviders);
    expect(revokeResponse.body).toEqual('200');

    await expect(refreshToken(dummyEvent, dummyContext, testProviders)).rejects.toThrow(ValidationError);
  }, 40000);

  it('should throw a validation error if the refreshToken is not valid', async () => {
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

    const response = await getToken(event, dummyContext, testProviders);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    // Override the refresh_token with id_token value.
    const jsonBody = JSON.parse(response.body);
    const idToken: Oauth2Token = {
      id_token: jsonBody.idToken,
      refresh_token: jsonBody.idToken,
      expires_in: jsonBody.expiresIn,
    };
    const cookie = `idToken=${JSON.stringify({
      id_token: idToken.id_token,
      expires_in: idToken.expires_in,
    })};refreshToken=${JSON.stringify({ refresh_token: idToken.refresh_token })}`;

    const dummyEvent = getDummyEvent({
      headers: { cookie },
    });

    await expect(revokeToken(dummyEvent, dummyContext, testProviders)).rejects.toThrow(ValidationError);
  }, 40000);
});
