/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  DataSetService,
  DataSetsStoragePlugin,
} from "@aws/workbench-core-datasets";

export interface ApiRouteConfig {
  routes: ApiRoute[];
  dataSetService: DataSetService;
  dataSetsStoragePlugin: DataSetsStoragePlugin;
  allowedOrigins: string[];
}

export interface ApiRoute {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any;
  serviceAction: string;
  httpMethod: HTTPMethod;
}

export type HTTPMethod = "post" | "put" | "delete" | "get";
