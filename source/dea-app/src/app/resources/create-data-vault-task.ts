/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DataVaultTaskDTO, DeaDataVaultTaskInput } from '../../models/data-vault-task';
import { createDataVaultTaskSchema } from '../../models/validation/data-vault';
import { joiUlid } from '../../models/validation/joi-common';
import { createDatasyncTask, createS3Location } from '../services/data-sync-service';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createDataVaultTask: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  await DataVaultService.getRequiredDataVault(dataVaultId, providers.repositoryProvider);

  const deaDataVaultTask: DataVaultTaskDTO = getRequiredPayload(
    event,
    'Create Data Vault Tasks',
    createDataVaultTaskSchema
  );

  const destinationFolder = `DATAVAULT${dataVaultId}/${
    deaDataVaultTask.destinationFolder ? deaDataVaultTask.destinationFolder.replace(/^\//, '') : ''
  }`;

  const destinationLocationArn = await createS3Location(destinationFolder, providers.dataSyncProvider);
  const taskArn = await createDatasyncTask(
    deaDataVaultTask.name,
    deaDataVaultTask.sourceLocationArn,
    destinationLocationArn,
    providers.dataSyncProvider
  );

  const taskId = taskArn.split('/').pop() || '';

  const dataVaultTask: DeaDataVaultTaskInput = {
    taskId: taskId,
    dataVaultUlid: dataVaultId,
    name: deaDataVaultTask.name,
    destinationFolder: destinationFolder,
    description: deaDataVaultTask.description,
    sourceLocationArn: deaDataVaultTask.sourceLocationArn,
    destinationLocationArn: destinationLocationArn,
    taskArn: taskArn,
    deleted: false,
  };

  const responseBody = await DataVaultService.createDataVaultTask(
    dataVaultTask,
    providers.repositoryProvider
  );

  return responseOk(event, responseBody);
};
