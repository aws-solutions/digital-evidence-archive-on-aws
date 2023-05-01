/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getToken } from '../../../app/resources/get-token';
import { refreshToken } from '../../../app/resources/refresh-token';
import { revokeToken } from '../../../app/resources/revoke-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent, setCookieToCookie } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let cognitoParams: CognitoSsmParams;
let repositoryProvider: ModelRepositoryProvider;
let pkceStrings: PkceStrings;

describe('revoke-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

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
    cognitoParams = await getCognitoSsmParams();
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

    const response = await getToken(event, dummyContext);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const dummyEvent = getDummyEvent({
      headers: { cookie: setCookieToCookie(response) },
    });

    // revoke token (marks session as revoked)
    const revokeResponse = await revokeToken(dummyEvent, dummyContext, repositoryProvider);
    expect(revokeResponse.body).toEqual('200');

    await expect(refreshToken(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      'Request failed with status code 400'
    );
  }, 40000);
});
