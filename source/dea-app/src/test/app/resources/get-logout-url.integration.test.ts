/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLogoutUrl } from '../../../app/resources/get-logout-url';
import { getCognitoLogoutUrl, getCognitoSsmParams } from '../../../app/services/auth-service';
import { getDummyEvent, dummyContext } from '../../integration-objects';

let expectedUrl: string;
describe('get-login-url', () => {
  beforeAll(async () => {
    // get SSM parameters to compare
    const cognitoParams = await getCognitoSsmParams();
    expectedUrl = `${cognitoParams.cognitoDomainUrl}/logout?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
  });

  it('successfully get credentials from id token', async () => {
    const logoutUrl = await getCognitoLogoutUrl();
    expect(logoutUrl).toEqual(expectedUrl);
  });

  it('successfully get login url from get-login-url', async () => {
    const response = await getLogoutUrl(getDummyEvent(), dummyContext);
    if (!response.body) {
      fail();
    }
    expect(JSON.parse(response.body)).toEqual(expectedUrl);
  });
});
