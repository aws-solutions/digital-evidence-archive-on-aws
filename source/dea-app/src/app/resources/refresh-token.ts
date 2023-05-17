/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getExpirationTimeFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getOauthToken } from '../../lambda-http-helpers';
import { useRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const refreshToken: DEAGatewayProxyHandler = async (event) => {
  const oauthToken = getOauthToken(event);
  const [refreshTokenResult, identityPoolId, userPoolId] = await useRefreshToken(oauthToken.refresh_token);

  const idTokenPayload = await getTokenPayload(
    refreshTokenResult.id_token,
    process.env.AWS_REGION ?? 'us-east-1'
  );

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
