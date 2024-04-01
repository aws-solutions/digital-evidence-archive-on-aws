/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { defaultCacheProvider } from '../../storage/cache';
import { defaultParametersProvider } from '../../storage/parameters';
import { getAvailableEndpoints } from '../services/parameter-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getAvailableEndpointsForUser: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  _repositoryProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  cacheProvider = defaultCacheProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  parametersProvider = defaultParametersProvider
) => {
  const actions = await getAvailableEndpoints(event, parametersProvider, cacheProvider);
  return responseOk(event, { endpoints: actions });
};
