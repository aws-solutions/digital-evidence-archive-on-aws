/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { getQueryParam } from '../../lambda-http-helpers';
import { loginUrlRegex } from '../../models/validation/joi-common';
import { getLoginHostedUiUrl } from '../services/auth-service';

import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getLoginUrl: DEAGatewayProxyHandler = async (event) => {
  const callbackUrl = getQueryParam(event, 'callbackUrl', '', Joi.string().uri());

  const loginUrl = await getLoginHostedUiUrl(callbackUrl);

  Joi.assert(loginUrl, loginUrlRegex);
  return responseOk(event, loginUrl);
};
