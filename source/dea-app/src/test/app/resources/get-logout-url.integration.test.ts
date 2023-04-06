/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLogoutUrl } from '../../../app/resources/get-logout-url';
import {
  CognitoSsmParams,
  getCognitoLogoutUrl,
  getCognitoSsmParams,
} from '../../../app/services/auth-service';
import { getDummyEvent, dummyContext } from '../../integration-objects';

let expectedUrl: string;
let cognitoParams: CognitoSsmParams;
describe('get-logout-url', () => {
  beforeAll(async () => {
    // get SSM parameters to compare
    cognitoParams = await getCognitoSsmParams();
    expectedUrl = `${cognitoParams.cognitoDomainUrl}/logout?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;
  });

  it('successfully get credentials from id token', async () => {
    const logoutUrl = await getCognitoLogoutUrl(cognitoParams.callbackUrl);
    expect(logoutUrl).toEqual(expectedUrl);
  });

  it('successfully get logout url from get-login-url', async () => {
    const response = await getLogoutUrl(getDummyEvent(), dummyContext);
    if (!response.body) {
      fail();
    }
    expect(JSON.parse(response.body)).toEqual(expectedUrl);
  });
});
