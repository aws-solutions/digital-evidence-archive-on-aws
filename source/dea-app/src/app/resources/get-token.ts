/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { idToken, safeName } from '../../models/validation/joi-common';
import { decodeTokenForUsername, exchangeAuthorizationCode } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getToken: DEAGatewayProxyHandler = async (event) => {
  const authCode = getRequiredPathParam(event, 'authCode');
  const getTokenResult = await exchangeAuthorizationCode(authCode);
  Joi.assert(getTokenResult, idToken);

  const username = decodeTokenForUsername(getTokenResult);
  Joi.assert(username, safeName);

  const responseBody = {
    idToken: getTokenResult,
    username: username,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(responseBody),
  };
};
