/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient } from '@aws-sdk/client-athena';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { DatasetsProvider } from '../../storage/datasets';
import { DataSyncProvider } from '../../storage/dataSync';
import { ParametersProvider } from '../../storage/parameters';

export type LambdaEvent = APIGatewayProxyEvent;
export type LambdaContext = Context;
export type LambdaRepositoryProvider = ModelRepositoryProvider;
export type LambdaParametersProvider = ParametersProvider;

export type DEAGatewayProxyHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  repositoryProvider?: ModelRepositoryProvider,
  parametersProvider?: ParametersProvider,
  datasetsProvider?: DatasetsProvider,
  athenaClientProvider?: AthenaClient,
  dataSyncProvider?: DataSyncProvider
) => Promise<APIGatewayProxyResult>;
