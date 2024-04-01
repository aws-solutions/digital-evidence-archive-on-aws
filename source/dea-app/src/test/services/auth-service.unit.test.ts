/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import NodeCache from 'node-cache';
import { getLoginHostedUiUrl, getCognitoLogoutUrl } from '../../app/services/auth-service';
import { createCacheProvider } from '../../storage/cache';
import { PARAM_PREFIX } from '../../storage/parameters';

const stage = process.env.STAGE ?? 'devsample';
const cognitoDomainPath = `${PARAM_PREFIX}${stage}-userpool-cognito-domain-param`;

const testParamProvider = {
  async getSecretValue(_secretName: string): Promise<string> {
    return 'bogus';
  },
  async getSsmParameterValue(parameterPath: string): Promise<string> {
    switch (parameterPath) {
      case cognitoDomainPath:
        return 'https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com';
      default:
        return 'bogus';
    }
  },
  async getSsmParametersValue(_parameterPaths: string[]): Promise<(string | undefined)[]> {
    return [
      'https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com',
      'bogus',
      'bogus',
      'bogus',
      'bogus',
      'bogus',
    ];
  },
};

const testCacheProvider = createCacheProvider(new NodeCache());

describe('auth service unit', () => {
  const oldEnv = process.env;
  beforeAll(() => {
    process.env.AWS_REGION = 'us-gov-west-1';
  });
  afterAll(() => {
    process.env = oldEnv;
  });

  it('should respond with fips endpoint for us-gov-west-1 login', async () => {
    const loginUrl = await getLoginHostedUiUrl('someuri', testCacheProvider, testParamProvider);
    expect(loginUrl).toContain('https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com');
  });

  it('should respond with fips endpoint for us-gov-west-1 logout', async () => {
    const loginUrl = await getCognitoLogoutUrl('someuri', testCacheProvider, testParamProvider);
    expect(loginUrl).toContain('https://someprefix.auth-fips.us-gov-west-1.amazoncognito.com');
  });
});
