/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getRequiredPayload } from '../../lambda-http-helpers';
import { RevokeToken } from '../../models/auth';
import { RevokeTokenSchema } from '../../models/validation/auth';
import { revokeRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const revokeToken: DEAGatewayProxyHandler = async (event) => {
  const refreshTokenPayload: RevokeToken = getRequiredPayload(event, 'refresh_token', RevokeTokenSchema);
  console.log('payload found');
  console.log('refresh token is ', refreshTokenPayload.refreshToken);
  const revokeTokenResult = await revokeRefreshToken(refreshTokenPayload.refreshToken);

  return responseOk(revokeTokenResult);
};
