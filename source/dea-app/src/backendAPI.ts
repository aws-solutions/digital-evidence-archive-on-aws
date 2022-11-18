/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Express } from 'express';
import { IApiRouteConfig } from './apiRouteConfig';
import { generateRouter } from './generateRouter';
import { HelloWorldService } from './services/helloWorldService';

export interface IBackendApiDependencyProvider {
  helloWorldService: HelloWorldService;
}

export const getBackendApiApp = (
  dependencyProvider: IBackendApiDependencyProvider = { helloWorldService: new HelloWorldService() }
): Express => {
  const apiRouteConfig: IApiRouteConfig = {
    routes: [
      {
        path: '/hi',
        serviceAction: 'sayHello',
        httpMethod: 'get',
        service: dependencyProvider.helloWorldService,
      },
      {
        path: '/bye',
        serviceAction: 'sayBye',
        httpMethod: 'get',
        service: dependencyProvider.helloWorldService,
      },
    ],
    allowedOrigins: JSON.parse(process.env.ALLOWED_ORIGINS || '[]'),
  };
  return generateRouter(apiRouteConfig);
};
