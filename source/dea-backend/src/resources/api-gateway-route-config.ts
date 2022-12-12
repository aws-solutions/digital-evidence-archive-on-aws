/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface ApiGatewayRouteConfig {
  routes: ApiGatewayRoute[];
  allowedOrigins: string[];
}

export interface ApiGatewayRoute {
  path: string;
  pathToSource: string;
  httpMethod: ApiGatewayMethod;
  pagination?: boolean;
}

export enum ApiGatewayMethod {
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  GET = 'GET',
}
