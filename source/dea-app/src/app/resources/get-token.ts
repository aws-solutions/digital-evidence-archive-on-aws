/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { idToken } from '../../models/validation/joi-common';
import { exchangeAuthorizationCode } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getToken: DEAGatewayProxyHandler = async (event, context) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const authCode = getRequiredPathParam(event, 'authCode');
  const getTokenResult = await exchangeAuthorizationCode(authCode);

  Joi.assert(getTokenResult, idToken);
  return {
    statusCode: 200,
    body: JSON.stringify(getTokenResult),
  };
};
