/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getExpirationTimeFromToken, getTokenPayload } from '../../cognito-token-helpers';
import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { ExchangeToken } from '../../models/auth';
import { ExchangeTokenSchema } from '../../models/validation/auth';
import { authCode as authCodeRegex } from '../../models/validation/joi-common';
import { exchangeAuthorizationCode } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const getToken: DEAGatewayProxyHandler = async (event) => {
  const authCode = getRequiredPathParam(event, 'authCode', authCodeRegex);
  const tokenPayload: ExchangeToken = getRequiredPayload(event, 'exchange token', ExchangeTokenSchema);

  const [getTokenResult, identityPoolId, userPoolId] = await exchangeAuthorizationCode(
    authCode,
    tokenPayload.codeVerifier,
    event.headers['origin'],
    event.headers['callback-override']
  );

  const idTokenPayload = await getTokenPayload(getTokenResult.id_token);
  let username = idTokenPayload['cognito:username'];
  if (idTokenPayload['given_name'] && idTokenPayload['family_name']) {
    username = `${idTokenPayload['given_name']} ${idTokenPayload['family_name']}`;
  }

  const expirationTime = getExpirationTimeFromToken(idTokenPayload);

  return okSetIdTokenCookie(
    event,
    getTokenResult,
    JSON.stringify({
      username,
      idToken: getTokenResult.id_token,
      identityPoolId: identityPoolId,
      userPoolId: userPoolId,
      expiresIn: expirationTime,
    })
  );
};
