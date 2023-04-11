/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AuditEventType } from '@aws/dea-app/lib/app/services/audit-service';
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';

export interface ApiGatewayRouteConfig {
  readonly routes: ApiGatewayRoute[];
}

export interface ApiGatewayRoute {
  readonly eventName: AuditEventType;
  readonly path: string;
  readonly pathToSource: string;
  readonly httpMethod: ApiGatewayMethod;
  readonly pagination?: boolean;
  readonly queryParams?: string[];
  readonly authMethod?: AuthorizationType; //Override authorization type if auth type should be custom or none
}

export enum ApiGatewayMethod {
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  GET = 'GET',
}
