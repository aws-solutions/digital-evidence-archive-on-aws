/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getExpirationTimeFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getOauthToken } from '../../lambda-http-helpers';
import { useRefreshToken } from '../services/auth-service';
import { getUserPoolInfo } from '../services/parameter-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const refreshToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const oauthToken = getOauthToken(event);
  const [refreshTokenResult, identityPoolId, userPoolId] = await useRefreshToken(
    oauthToken.refresh_token,
    providers.cacheProvider,
    providers.parametersProvider
  );

  const userPoolInfo = await getUserPoolInfo(providers.parametersProvider, providers.cacheProvider);
  const idTokenPayload = await getTokenPayload(refreshTokenResult.id_token, userPoolInfo);

  const expirationTime = getExpirationTimeFromToken(idTokenPayload);

  return okSetIdTokenCookie(
    event,
    refreshTokenResult,
    JSON.stringify({
      idToken: refreshTokenResult.id_token,
      identityPoolId: identityPoolId,
      userPoolId: userPoolId,
      expiresIn: expirationTime,
    })
  );
};
