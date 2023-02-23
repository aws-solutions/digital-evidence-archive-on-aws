/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { DatasetsProvider } from '../../storage/datasets';

export type LambdaEvent = APIGatewayProxyEvent;
export type LambdaContext = Context;
export type LambdaRepositoryProvider = ModelRepositoryProvider;

export type DEAGatewayProxyHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  repositoryProvider?: ModelRepositoryProvider,
  datasetsProvider?: DatasetsProvider
) => Promise<APIGatewayProxyResult>;
