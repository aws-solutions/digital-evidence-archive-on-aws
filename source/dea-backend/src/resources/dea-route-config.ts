/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ApiGatewayMethod, ApiGatewayRouteConfig } from './api-gateway-route-config';

export const deaApiRouteConfig: ApiGatewayRouteConfig = {
  routes: [
    {
      path: '/cases/my-cases',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-my-cases-handler.ts',
      pagination: true,
    },
    {
      path: '/cases/all-cases',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-all-cases-handler.ts',
      pagination: true,
    },
    {
      path: '/cases',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-cases-handler.ts',
    },
    {
      path: '/cases/{caseId}',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-detail-handler.ts',
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
      path: '/cases/{caseId}/files',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/initiate-case-file-upload-handler.ts',
    },
    {
      path: '/cases/{caseId}/files',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/complete-case-file-upload-handler.ts',
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
