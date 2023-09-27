/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createDataVault } from '../../../app/resources/create-data-vault';
import { createDataVaultTask } from '../../../app/resources/create-data-vault-task';
import { getDataVaultTasks } from '../../../app/resources/get-data-vault-tasks';
import { createS3Location } from '../../../app/services/data-sync-service';
import { DeaDataVaultTask } from '../../../models/data-vault-task';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { DataSyncProvider, defaultDataSyncProvider } from '../../../storage/dataSync';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

describe('get data vault tasks', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getDataVaultTasksTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should return data vault tasks for a given data vault ID', async () => {
    const dataVaultTaskName1 = 'testDataVault1';
    const dataVaultTaskName2 = 'testDataVault2';

    // Create multiple data vault for testing
    const response = await createDataVault(
      getDummyEvent({
        body: JSON.stringify({
          name: 'test',
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    const newDataVault = JSON.parse(response.body);

    // Create source location arn
    const locationArn1 = await createS3Location(
      `/DATAVAULT${newDataVault.ulid}/locationtest1`,
      dataSyncProvider
    );

    await createDataVaultTask(
      getDummyEvent({
        pathParameters: {
          dataVaultId: newDataVault.ulid,
        },
        body: JSON.stringify({
          name: dataVaultTaskName1,
          sourceLocationArn: locationArn1,
          destinationFolder: 'testbucket',
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    await createDataVaultTask(
      getDummyEvent({
        pathParameters: {
          dataVaultId: newDataVault.ulid,
        },
        body: JSON.stringify({
          name: dataVaultTaskName2,
          sourceLocationArn: locationArn1,
          destinationFolder: 'testbucket',
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
    });
    const taskResponse = await getDataVaultTasks(event, dummyContext, repositoryProvider);
    const dataVaultTasks: DeaDataVaultTask[] = JSON.parse(taskResponse.body).dataVaultTasks;
    expect(dataVaultTasks.length).toEqual(2);
    expect(dataVaultTasks.find((dataVaultTask) => dataVaultTask.name === dataVaultTaskName1)).toBeDefined();
    expect(dataVaultTasks.find((dataVaultTask) => dataVaultTask.name === dataVaultTaskName2)).toBeDefined();
  });

  it('should fail to return data vault tasks if missing data vault ID', async () => {
    const event = getDummyEvent({});
    await expect(getDataVaultTasks(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Required path param 'dataVaultId' is missing.`
    );
  });
});
