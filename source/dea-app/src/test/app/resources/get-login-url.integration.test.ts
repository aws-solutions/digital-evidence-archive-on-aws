/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLoginUrl } from '../../../app/resources/get-login-url';
import { getLoginHostedUiUrl } from '../../../app/services/auth-service';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/parameter-service';
import { defaultCacheProvider } from '../../../storage/cache';
import { defaultParametersProvider } from '../../../storage/parameters';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';

let expectedUrl: string;
let cognitoParams: CognitoSsmParams;

describe('get-login-url', () => {
  beforeAll(async () => {
    // get SSM parameters to compare
    cognitoParams = await getCognitoSsmParams(defaultParametersProvider, defaultCacheProvider);
    expectedUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
  });

  it('successfully get login url from auth service', async () => {
    const loginUrl = await getLoginHostedUiUrl(
      cognitoParams.callbackUrl,
      defaultCacheProvider,
      defaultParametersProvider
    );
    expect(loginUrl).toEqual(expectedUrl);
  });

  it('successfully get login url from get-login-url', async () => {
    const event = getDummyEvent({
      queryStringParameters: {
        callbackUrl: cognitoParams.callbackUrl,
      },
    });

    const response = await getLoginUrl(event, dummyContext, createTestProvidersObject({}));
    if (!response.body) {
      fail();
    }
    expect(JSON.parse(response.body)).toEqual(expectedUrl);
  });
});
