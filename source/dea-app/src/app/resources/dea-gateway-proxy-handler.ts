/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient } from '@aws-sdk/client-athena';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ModelRepositoryProvider, defaultProvider } from '../../persistence/schema/entities';
import { CacheProvider, defaultCacheProvider } from '../../storage/cache';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { DataSyncProvider, defaultDataSyncProvider } from '../../storage/dataSync';
import { ParametersProvider, defaultParametersProvider } from '../../storage/parameters';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';

export type LambdaEvent = APIGatewayProxyEvent;
export type LambdaContext = Context;
export type LambdaCacheProvider = CacheProvider;
export type LambdaRepositoryProvider = ModelRepositoryProvider;
export type LambdaParametersProvider = ParametersProvider;

export type LambdaProviders = {
  readonly repositoryProvider: ModelRepositoryProvider;
  readonly cacheProvider: CacheProvider;
  readonly parametersProvider: ParametersProvider;
  readonly datasetsProvider: DatasetsProvider;
  readonly athenaClient: AthenaClient;
  readonly dataSyncProvider: DataSyncProvider;
};

export type DEAGatewayProxyHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  providers?: LambdaProviders
) => Promise<APIGatewayProxyResult>;

export const defaultProviders = {
  repositoryProvider: defaultProvider,
  cacheProvider: defaultCacheProvider,
  parametersProvider: defaultParametersProvider,
  datasetsProvider: defaultDatasetsProvider,
  athenaClient: defaultAthenaClient,
  dataSyncProvider: defaultDataSyncProvider,
};
