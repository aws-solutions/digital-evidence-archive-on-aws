/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { DataVaultExecutionDTO, DeaDataVaultExecution } from '../../models/data-vault-execution';
import { createDataVaultExecutionSchema } from '../../models/validation/data-vault';
import { taskIdJoi } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultDataSyncProvider } from '../../storage/dataSync';
import { defaultCloudwatchClient } from '../audit/dea-audit-plugin';
import { ValidationError } from '../exceptions/validation-exception';
import { getDataSyncTask, startDatasyncTaskExecution } from '../services/data-sync-service';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createDataVaultExecution: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  _cloudwatchClient = defaultCloudwatchClient,
  /* istanbul ignore next */
  dataSyncProvider = defaultDataSyncProvider
) => {
  const dataVaultExecutionDTO: DataVaultExecutionDTO = getRequiredPayload(
    event,
    'Execute Data Vault Task',
    createDataVaultExecutionSchema
  );
  const taskId = getRequiredPathParam(event, 'taskId', taskIdJoi);
  const userUlid = getUserUlid(event);

  if (!dataVaultExecutionDTO.taskArn.includes(taskId)) {
    throw new ValidationError('Requested task ID does not match resource');
  }

  const dataVaultTask = await getDataSyncTask(dataVaultExecutionDTO.taskArn, dataSyncProvider);
  // Create the task in DDB if doesn't exists.
  try {
    await DataVaultService.createDataVaultTask(dataVaultTask, repositoryProvider);
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error;
    }
  }

  const executionArn = await startDatasyncTaskExecution(dataVaultExecutionDTO.taskArn, dataSyncProvider);

  const executionId = executionArn.split('/').pop() || '';

  const dataVaultExecution: DeaDataVaultExecution = {
    taskId,
    executionId,
    createdBy: userUlid,
  };

  const responseBody = await DataVaultService.createDataVaultExecution(
    dataVaultExecution,
    repositoryProvider
  );

  return responseOk(event, responseBody);
};
