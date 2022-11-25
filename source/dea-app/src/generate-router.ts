/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import cors from 'cors';
import express = require('express');
import { Router, Express, Request, Response } from 'express';
import { IApiRoute, IApiRouteConfig } from './api-route-config';
import { boomErrorHandler, unknownErrorHandler } from './error-handlers';

export function generateRouter(apiRouteConfig: IApiRouteConfig): Express {
  const app: Express = express();
  const router: Router = express.Router();

  app.use(cors({ origin: apiRouteConfig.allowedOrigins }));
  // parse application/json
  app.use(express.json());

  // Dynamic routes
  apiRouteConfig.routes.forEach((apiRoute: IApiRoute) => {
    // Config setting is provided by developer, and not external user request
    // nosemgrep
    router[apiRoute.httpMethod](apiRoute.path, async (req: Request, res: Response) => {
      // Config setting is provided by developer, and not external user request
      // nosemgrep
      const response = await apiRoute.service[apiRoute.serviceAction]();
      res.send(response);
    });
  });

  // Error handling. Order of the error handlers is important
  router.use(boomErrorHandler);
  router.use(unknownErrorHandler);

  app.use('/', router);

  return app;
}