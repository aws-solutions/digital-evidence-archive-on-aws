/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getExpirationTimeFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getOauthToken } from '../../lambda-http-helpers';
import { defaultCacheProvider } from '../../storage/cache';
import { defaultParametersProvider } from '../../storage/parameters';
import { useRefreshToken } from '../services/auth-service';
import { getUserPoolInfo } from '../services/parameter-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const refreshToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  _repositoryProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  cacheProvider = defaultCacheProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  parametersProvider = defaultParametersProvider
) => {
  const oauthToken = getOauthToken(event);
  const [refreshTokenResult, identityPoolId, userPoolId] = await useRefreshToken(
    oauthToken.refresh_token,
    cacheProvider,
    parametersProvider
  );

  const userPoolInfo = await getUserPoolInfo(parametersProvider, cacheProvider);
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
