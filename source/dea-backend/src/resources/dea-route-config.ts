/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ApiGatewayMethod, ApiGatewayRouteConfig } from './api-gateway-route-config';

export const deaApiRouteConfig: ApiGatewayRouteConfig = {
  routes: [
    {
      path: '/cases',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-cases-handler.ts',
      pagination: true,
    },
    {
      path: '/cases',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-cases-handler.ts',
    },
    {
      path: '/cases/{caseId}',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/update-cases-handler.ts',
    },
    {
      path: '/cases/{caseId}',
      httpMethod: ApiGatewayMethod.DELETE,
      pathToSource: '../../src/handlers/delete-case-handler.ts',
    },
    {
      path: '/cases/{caseId}/userMemberships',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-case-user-handler.ts',
    },
    {
      path: '/hi',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/say-hello-handler.ts',
    },
    {
      path: '/bye',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/say-bye-handler.ts',
    },
  ],
  allowedOrigins: JSON.parse(process.env.ALLOWED_ORIGINS || '[]'),
};
