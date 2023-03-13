/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { loginUrlRegex } from '../../models/validation/joi-common';
import { getCognitoLogoutUrl } from '../services/auth-service';

import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getLogoutUrl: DEAGatewayProxyHandler = async () => {
  const logoutUrl = await getCognitoLogoutUrl();

  Joi.assert(logoutUrl, loginUrlRegex);
  return responseOk(logoutUrl);
};
