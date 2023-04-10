/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOauthToken, getTokenId, getUserUlid } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { useRefreshToken } from '../services/auth-service';
import { markSessionAsRevoked } from '../services/session-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { okSetIdTokenCookie } from './dea-lambda-utils';

export const refreshToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const oauthToken = getOauthToken(event);
  const refreshTokenResult = await useRefreshToken(oauthToken.refresh_token);

  // Now mark the previous session as revoked in db
  // so the new idtoken can be used in api calls
  // to pass the "no concurrent user sessions" session req check
  const userUlid = getUserUlid(event);
  const tokenId = getTokenId(event);
  await markSessionAsRevoked(userUlid, tokenId, repositoryProvider);

  return okSetIdTokenCookie(refreshTokenResult, '');
};
