/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';

export interface ApiGatewayRouteConfig {
  routes: ApiGatewayRoute[];
  allowedOrigins: string[];
}

export interface ApiGatewayRoute {
  path: string;
  pathToSource: string;
  httpMethod: ApiGatewayMethod;
  pagination?: boolean;
  authMethod?: AuthorizationType | undefined;
}

export enum ApiGatewayMethod {
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  GET = 'GET',
}
