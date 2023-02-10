/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { AxiosError } from 'axios';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getToken } from '../../../app/resources/get-token';
import { getCognitoSsmParams } from '../../../app/services/auth-service';

import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { dummyContext, dummyEvent } from '../../integration-objects';

let cognitoDomain: string, callbackUrl: string;

describe('get-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'cognitoHelpersIntegrationTestUser';
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    [cognitoDomain, , callbackUrl] = await getCognitoSsmParams();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('successfully get id token using auth code', async () => {
    const authCode = await cognitoHelper.getAuthorizationCode(cognitoDomain, callbackUrl, testUser);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          authCode: authCode,
        },
      }
    );

    const response = await getToken(event, dummyContext);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }
  });

  it('should throw an error if the authorization code is not valid', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          authCode: 'DUMMYAUTHCODE',
        },
      }
    );

    await expect(getToken(event, dummyContext)).rejects.toThrow(AxiosError);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getToken(dummyEvent, dummyContext)).rejects.toThrow(ValidationError);
  });
});
