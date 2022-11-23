/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface IApiRouteConfig {
  routes: IApiRoute[];
  allowedOrigins: string[];
}

export interface IApiRoute {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any;
  serviceAction: string;
  httpMethod: HTTPMethod;
}

export type HTTPMethod = 'post' | 'put' | 'delete' | 'get';
