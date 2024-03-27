/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

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
  parametersProvider = defaultParametersProvider
) => {
  const actions = await getAvailableEndpoints(event, parametersProvider);
  return responseOk(event, { endpoints: actions });
};
