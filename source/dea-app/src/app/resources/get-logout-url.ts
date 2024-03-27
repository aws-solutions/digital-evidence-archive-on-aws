/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import Joi from 'joi';
import { getQueryParam } from '../../lambda-http-helpers';
import { loginUrlRegex } from '../../models/validation/joi-common';
import { defaultParametersProvider } from '../../storage/parameters';
import { getCognitoLogoutUrl } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getLogoutUrl: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  _repositoryProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  parametersProvider = defaultParametersProvider
) => {
  const callbackUrl = getQueryParam(event, 'callbackUrl', '', Joi.string().uri());

  const logoutUrl = await getCognitoLogoutUrl(callbackUrl, parametersProvider);

  Joi.assert(logoutUrl, loginUrlRegex);
  return responseOk(event, logoutUrl);
};
