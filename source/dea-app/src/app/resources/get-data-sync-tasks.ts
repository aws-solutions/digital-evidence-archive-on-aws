/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getStringPaginationParameters } from '../../lambda-http-helpers';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { dataSyncPaginationLimit } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultDataSyncProvider } from '../../storage/dataSync';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';
import * as dataSyncService from '../services/data-sync-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getDataSyncTasks: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  _repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  _athenaClient = defaultAthenaClient,
  /* istanbul ignore next */
  dataSyncProvider = defaultDataSyncProvider
) => {
  const { limit, next } = getStringPaginationParameters(event, dataSyncPaginationLimit);

  const listTasksResponse = await dataSyncService.listDatasyncTasks(dataSyncProvider, limit, next);

  // Create an array to store DeaDataSyncTask objects
  const deaDataSyncTasks: DeaDataSyncTask[] = [];

  // Loop through the tasks and fetch details for each
  for (const task of listTasksResponse.Tasks ?? []) {
    if (task.TaskArn) {
      const deaDataSyncTask = await dataSyncService.describeTask(task.TaskArn, dataSyncProvider);
      deaDataSyncTasks.push(deaDataSyncTask);
    }
  }

  return responseOk(event, {
    dataSyncTasks: deaDataSyncTasks,
    next: listTasksResponse.NextToken,
  });
};
