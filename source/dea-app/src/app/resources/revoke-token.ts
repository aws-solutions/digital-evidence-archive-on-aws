/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getOauthToken } from '../../lambda-http-helpers';
import { revokeRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const revokeToken: DEAGatewayProxyHandler = async (event) => {
  const oauthToken = getOauthToken(event);
  const revokeTokenResult = await revokeRefreshToken(oauthToken.refresh_token);

  return responseOk(event, revokeTokenResult);
};
