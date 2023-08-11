/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { getLoginHostedUiUrl, getCognitoLogoutUrl } from '../../app/services/auth-service';

const stage = process.env.STAGE ?? 'devsample';
const cognitoDomainPath = `/dea/${stage}-userpool-cognito-domain-param`;
const clientIdPath = `/dea/${stage}-userpool-client-id-param`;
const callbackUrlPath = `/dea/${stage}-client-callback-url-param`;
const identityPoolIdPath = `/dea/${stage}-identity-pool-id-param`;
const userPoolIdPath = `/dea/${stage}-userpool-id-param`;
const agencyIdpNamePath = `/dea/${stage}-agency-idp-name`;

describe('auth service unit', () => {
  const oldEnv = process.env;
  beforeAll(() => {
    process.env.AWS_REGION = 'us-gov-west-1';

    const client = mockClient(SSMClient);
    client.resolves({
      Parameters: [
        { Name: cognitoDomainPath, Value: 'https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com' },
        { Name: clientIdPath, Value: 'bogus' },
        { Name: callbackUrlPath, Value: 'bogus' },
        { Name: identityPoolIdPath, Value: 'bogus' },
        { Name: userPoolIdPath, Value: 'bogus' },
        { Name: agencyIdpNamePath, Value: 'bogus' },
      ],
    });
  });
  afterAll(() => {
    process.env = oldEnv;
  });

  it('should respond with fips endpoint for us-gov-west-1 login', async () => {
    const loginUrl = await getLoginHostedUiUrl('someuri');
    expect(loginUrl).toContain('https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com');
  });

  it('should respond with fips endpoint for us-gov-west-1 logout', async () => {
    const loginUrl = await getCognitoLogoutUrl('someuri');
    expect(loginUrl).toContain('https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com');
  });
});
