/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getOauthToken } from '../../lambda-http-helpers';
import { revokeRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const revokeToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const oauthToken = getOauthToken(event);
  const revokeTokenResult = await revokeRefreshToken(
    oauthToken.refresh_token,
    providers.cacheProvider,
    providers.parametersProvider
  );

  return responseOk(event, revokeTokenResult);
};
