/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { ExchangeToken } from '../../models/auth';
import { ExchangeTokenSchema } from '../../models/validation/auth';
import { authCode as authCodeRegex } from '../../models/validation/joi-common';
import { exchangeAuthorizationCode } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getToken: DEAGatewayProxyHandler = async (event) => {
  const authCode = getRequiredPathParam(event, 'authCode', authCodeRegex);
  const getTokenPayload: ExchangeToken = getRequiredPayload(event, 'exchange token', ExchangeTokenSchema);

  const getTokenResult = await exchangeAuthorizationCode(
    authCode,
    getTokenPayload.codeVerifier,
    event.headers['origin'],
    event.headers['callback-override']
  );

  return responseOk(getTokenResult);
};
