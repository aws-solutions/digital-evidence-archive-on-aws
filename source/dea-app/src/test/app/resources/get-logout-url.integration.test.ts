/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLogoutUrl } from '../../../app/resources/get-logout-url';
import { getCognitoLogoutUrl } from '../../../app/services/auth-service';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/parameter-service';
import { defaultCacheProvider } from '../../../storage/cache';
import { defaultParametersProvider } from '../../../storage/parameters';
import { getDummyEvent, dummyContext, createTestProvidersObject } from '../../integration-objects';

let expectedUrl: string;
let cognitoParams: CognitoSsmParams;
describe('get-logout-url', () => {
  beforeAll(async () => {
    // get SSM parameters to compare
    cognitoParams = await getCognitoSsmParams(defaultParametersProvider, defaultCacheProvider);
    expectedUrl = `${cognitoParams.cognitoDomainUrl}/logout?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
  });

  it('successfully get credentials from id token', async () => {
    const logoutUrl = await getCognitoLogoutUrl(
      cognitoParams.callbackUrl,
      defaultCacheProvider,
      defaultParametersProvider
    );
    expect(logoutUrl).toEqual(expectedUrl);
  });

  it('successfully get logout url from get-login-url', async () => {
    const event = getDummyEvent({
      queryStringParameters: {
        callbackUrl: cognitoParams.callbackUrl,
      },
    });

    const response = await getLogoutUrl(event, dummyContext, createTestProvidersObject({}));
    if (!response.body) {
      fail();
    }
    expect(JSON.parse(response.body)).toEqual(expectedUrl);
  });
});
