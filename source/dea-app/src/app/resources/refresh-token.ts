/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOauthToken } from '../../lambda-http-helpers';
import { useRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const refreshToken: DEAGatewayProxyHandler = async (event) => {
  const oauthToken = getOauthToken(event);
  const [refreshTokenResult, identityPoolId, userPoolId] = await useRefreshToken(oauthToken.refresh_token);

  return okSetIdTokenCookie(
    event,
    refreshTokenResult,
    JSON.stringify({
      idToken: refreshTokenResult.id_token,
      identityPoolId: identityPoolId,
      userPoolId: userPoolId,
    })
  );
};
