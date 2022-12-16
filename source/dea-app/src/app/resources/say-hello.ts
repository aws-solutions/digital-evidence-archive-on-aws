/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const sayHello: DEAGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    body: 'Hello DEA!',
  };
};
