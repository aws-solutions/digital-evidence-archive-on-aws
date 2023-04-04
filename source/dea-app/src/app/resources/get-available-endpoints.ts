/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getAvailableEndpoints } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getAvailableEndpointsForUser: DEAGatewayProxyHandler = async (event) => {
  const actions = await getAvailableEndpoints(event);
  return responseOk({ endpoints: actions });
};
