/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getCognitoSsmParams, getLoginHostedUiUrl } from '../../../app/services/auth-service';

describe('get-login-url', () => {
  it('successfully get credentials from id token', async () => {
    // get SSM parameters to compare
    const cognitoParams = await getCognitoSsmParams();
    const expectedUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;

    const loginUrl = await getLoginHostedUiUrl();
    expect(loginUrl).toEqual(expectedUrl);
  });
});
