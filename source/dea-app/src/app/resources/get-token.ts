/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { idToken, authCode as authCodeRegex } from '../../models/validation/joi-common';
import { exchangeAuthorizationCode } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getToken: DEAGatewayProxyHandler = async (event) => {
  const authCode = getRequiredPathParam(event, 'authCode', authCodeRegex);
  const getTokenResult = await exchangeAuthorizationCode(
    authCode,
    event.headers['origin'],
    event.headers['callback-override']
  );

  Joi.assert(getTokenResult, idToken);
  return responseOk(getTokenResult);
};
