/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DeaDataVaultTaskInput } from '../../models/data-vault-task';
import { createDataVaultTaskSchema } from '../../models/validation/data-vault';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultDataSyncProvider } from '../../storage/dataSync';
import { defaultCloudwatchClient } from '../audit/dea-audit-plugin';
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
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  _cloudwatchClient = defaultCloudwatchClient,
  /* istanbul ignore next */
  dataSyncProvider = defaultDataSyncProvider
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  const deaDataVaultTask: DeaDataVaultTaskInput = getRequiredPayload(
    event,
    'Create Data Vault Tasks',
    createDataVaultTaskSchema
  );

  const destinationS3Prefix = `DATAVAULT${dataVaultId}/${deaDataVaultTask.s3BucketPrefix.replace(/^\//, '')}`;

  const destinationLocationArn = await createS3Location(destinationS3Prefix, dataSyncProvider);
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
    s3BucketPrefix: destinationS3Prefix,
    description: deaDataVaultTask.description,
    sourceLocationArn: deaDataVaultTask.sourceLocationArn,
    destinationLocationArn: destinationLocationArn,
    taskArn: taskArn,
    deleted: false,
  };

  const responseBody = await DataVaultService.createDataVaultTask(dataVaultTask, repositoryProvider);

  return responseOk(event, responseBody);
};
