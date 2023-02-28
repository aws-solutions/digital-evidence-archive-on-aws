/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { NotAuthorizedException } from '@aws-sdk/client-cognito-identity';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getCredentials } from '../../../app/resources/get-credentials';
import { getToken } from '../../../app/resources/get-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';

import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { dummyContext, getDummyEvent } from '../../integration-objects';

let cognitoParams: CognitoSsmParams;

describe('get-credentials', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'credsIntegrationTestUser';
  const firstName = 'getCredentialsHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('successfully get credentials from id token', async () => {
    const authCode = await cognitoHelper.getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      cognitoParams.callbackUrl,
      testUser
    );

    const event = getDummyEvent({
      pathParameters: {
        authCode: authCode,
      },
    });

    const idToken = await getToken(event, dummyContext);

    const credentialsEvent = getDummyEvent({
      pathParameters: {
        idToken: idToken.body?.replace(/"/g, ''),
      },
    });

    const response = await getCredentials(credentialsEvent, dummyContext);
    if (!response.body) {
      fail();
    }
    const credentials = JSON.parse(response.body);
    expect(credentials).toHaveProperty('AccessKeyId');
    expect(credentials).toHaveProperty('SecretKey');
    expect(credentials).toHaveProperty('SessionToken');
  }, 20000);

  it('should throw an error if the id token is not valid', async () => {
    const event = getDummyEvent({
      pathParameters: {
        idToken: 'fake.fake.fake',
      },
    });

    await expect(getCredentials(event, dummyContext)).rejects.toThrow(NotAuthorizedException);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getCredentials(getDummyEvent(), dummyContext)).rejects.toThrow(ValidationError);
  });
});
