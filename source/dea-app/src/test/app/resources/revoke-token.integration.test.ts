/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getToken } from '../../../app/resources/get-token';
import { revokeToken } from '../../../app/resources/revoke-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { Oauth2Token } from '../../../models/auth';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { getAuthorizationCode } from '../../../test-e2e/helpers/auth-helper';

import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { dummyContext, getDummyEvent } from '../../integration-objects';

let cognitoParams: CognitoSsmParams;
let idToken: string;

describe('revoke-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'RevokeCodeIntegrationTestUser';
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('successfully revoke an refresh token', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword
    );

    const event = getDummyEvent({
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

    const retrievedTokens: Oauth2Token = jsonParseWithDates(response.body);

    // Store for next test
    idToken = retrievedTokens.id_token;

    const dummyEvent = getDummyEvent({
      body: JSON.stringify({
        refreshToken: retrievedTokens.refresh_token,
      }),
    });

    const revokeResponse = await revokeToken(dummyEvent, dummyContext);
    expect(revokeResponse.body).toEqual('200');
  }, 20000);

  it('should throw an error if trying to revoke id token', async () => {
    const dummyEvent = getDummyEvent({
      body: JSON.stringify({
        refreshToken: idToken,
      }),
    });

    await expect(revokeToken(dummyEvent, dummyContext)).rejects.toThrow(
      'Request failed with status code 400'
    );
  });

  it('should throw an error if the payload is missing', async () => {
    await expect(revokeToken(getDummyEvent(), dummyContext)).rejects.toThrow(ValidationError);
  });
});
