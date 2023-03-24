/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getRequiredPayload, getTokenId, getUserUlid } from '../../lambda-http-helpers';
import { RevokeToken } from '../../models/auth';
import { RevokeTokenSchema } from '../../models/validation/auth';
import { defaultProvider } from '../../persistence/schema/entities';
import { revokeRefreshToken } from '../services/auth-service';
import { markSessionAsRevoked } from '../services/session-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const revokeToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const refreshTokenPayload: RevokeToken = getRequiredPayload(event, 'refresh_token', RevokeTokenSchema);
  const revokeTokenResult = await revokeRefreshToken(refreshTokenPayload.refreshToken);

  // Now mark the session as revoked in db so user cannot gain access with the same
  // id token
  const userUlid = getUserUlid(event);
  const tokenId = getTokenId(event);
  await markSessionAsRevoked(userUlid, tokenId, repositoryProvider);

  return responseOk(revokeTokenResult);
};
