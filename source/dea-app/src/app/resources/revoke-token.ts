/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getOauthToken } from '../../lambda-http-helpers';
import { defaultParametersProvider } from '../../storage/parameters';
import { revokeRefreshToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const revokeToken: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  _repositoryProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  parametersProvider = defaultParametersProvider
) => {
  const oauthToken = getOauthToken(event);
  const revokeTokenResult = await revokeRefreshToken(oauthToken.refresh_token, parametersProvider);

  return responseOk(event, revokeTokenResult);
};
