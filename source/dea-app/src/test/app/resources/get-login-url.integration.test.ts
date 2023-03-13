/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getLoginUrl } from '../../../app/resources/get-login-url';
import { getCognitoSsmParams, getLoginHostedUiUrl } from '../../../app/services/auth-service';
import { dummyContext, getDummyEvent } from '../../integration-objects';

let expectedUrl: string;

describe('get-login-url', () => {
  beforeAll(async () => {
    // get SSM parameters to compare
    const cognitoParams = await getCognitoSsmParams();
    expectedUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
  });

  it('successfully get login url from auth service', async () => {
    const loginUrl = await getLoginHostedUiUrl();
    expect(loginUrl).toEqual(expectedUrl);
  });

  it('successfully get login url from get-login-url', async () => {
    const response = await getLoginUrl(getDummyEvent(), dummyContext);
    if (!response.body) {
      fail();
    }
    expect(JSON.parse(response.body)).toEqual(expectedUrl);
  });
});
