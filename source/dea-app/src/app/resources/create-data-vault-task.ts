/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DataVaultTaskDTO, DeaDataVaultTaskInput } from '../../models/data-vault-task';
import { createDataVaultTaskSchema } from '../../models/validation/data-vault';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultCacheProvider } from '../../storage/cache';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultDataSyncProvider } from '../../storage/dataSync';
import { defaultParametersProvider } from '../../storage/parameters';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';
import { createDatasyncTask, createS3Location } from '../services/data-sync-service';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createDataVaultTask: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  _cacheProvider = defaultCacheProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  _parametersProvider = defaultParametersProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  _athenaClient = defaultAthenaClient,
  /* istanbul ignore next */
  dataSyncProvider = defaultDataSyncProvider
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  await DataVaultService.getRequiredDataVault(dataVaultId, repositoryProvider);

  const deaDataVaultTask: DataVaultTaskDTO = getRequiredPayload(
    event,
    'Create Data Vault Tasks',
    createDataVaultTaskSchema
  );

  const destinationFolder = `DATAVAULT${dataVaultId}/${
    deaDataVaultTask.destinationFolder ? deaDataVaultTask.destinationFolder.replace(/^\//, '') : ''
  }`;

  const destinationLocationArn = await createS3Location(destinationFolder, dataSyncProvider);
  const taskArn = await createDatasyncTask(
    deaDataVaultTask.name,
    deaDataVaultTask.sourceLocationArn,
    destinationLocationArn,
    dataSyncProvider
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

  const responseBody = await DataVaultService.createDataVaultTask(dataVaultTask, repositoryProvider);

  return responseOk(event, responseBody);
};
