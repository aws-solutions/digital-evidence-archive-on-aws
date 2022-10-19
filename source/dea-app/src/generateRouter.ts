/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import cors from 'cors';
import express = require('express');
import { Router, Express, Request, Response } from 'express';
import { ApiRoute, ApiRouteConfig } from './apiRouteConfig';
import { setUpDSRoutes } from './datasetRoutes';
import { boomErrorHandler, unknownErrorHandler } from './errorHandlers';

export function generateRouter(apiRouteConfig: ApiRouteConfig): Express {
  const app: Express = express();
  const router: Router = express.Router();

  app.use(cors({ origin: apiRouteConfig.allowedOrigins }));
  // parse application/json
  app.use(express.json());

  // Dynamic routes
  apiRouteConfig.routes.forEach((apiRoute: ApiRoute) => {
    // Config setting is provided by developer, and not external user request
    // nosemgrep
    router[apiRoute.httpMethod](apiRoute.path, async (req: Request, res: Response) => {
      // Config setting is provided by developer, and not external user request
      // nosemgrep
      const response = await apiRoute.service[apiRoute.serviceAction]();
      res.send(response);
    });
  });

  setUpDSRoutes(router, apiRouteConfig.dataSetService, apiRouteConfig.dataSetsStoragePlugin);

  // Error handling. Order of the error handlers is important
  router.use(boomErrorHandler);
  router.use(unknownErrorHandler);

  app.use('/', router);

  return app;
}
