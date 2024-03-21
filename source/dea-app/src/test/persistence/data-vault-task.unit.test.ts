/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultTask, DeaDataVaultTaskInput } from '../../models/data-vault-task';
import { createDataVaultTask, listDataVaultTasks } from '../../persistence/data-vault-task';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getTestRepositoryProvider } from './local-db-table';

describe('data vault tasks persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultTasksTestsTable');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create a data vault task', async () => {
    const dataVaultTaskInput: DeaDataVaultTaskInput = {
      taskId: 'Data Vault Task 1',
      dataVaultUlid: 'DATAVAULTULID',
      name: 'Data Vault Task 1',
      description: 'Test Description',
      sourceLocationArn: 'sourceLocationArn',
      destinationLocationArn: 'destinationLocationArn',
      taskArn: 'taskArn',
      destinationFolder: 'DATAVAULTULID/dummyprefix',
      deleted: false,
    };

    const createdDataVaultTask = await createDataVaultTask(dataVaultTaskInput, repositoryProvider);

    expect(createdDataVaultTask).toBeDefined();
    expect(createdDataVaultTask.name).toBe(dataVaultTaskInput.name);
    expect(createdDataVaultTask.description).toBe(dataVaultTaskInput.description);
  });

  it('should list the first page of data vault tasks for a specific data vault', async () => {
    const dataVaultTask1Input: DeaDataVaultTaskInput = {
      taskId: 'Data Vault Task 2',
      dataVaultUlid: 'DATAVAULTULID',
      name: 'Data Vault Task 2',
      sourceLocationArn: 'sourceLocationArn',
      destinationLocationArn: 'destinationLocationArn',
      taskArn: 'taskArn',
      destinationFolder: 'DATAVAULTULID/dummyprefix',
      deleted: false,
    };

    const dataVaultTask2Input: DeaDataVaultTaskInput = {
      taskId: 'Data Vault Task 3',
      dataVaultUlid: 'DATAVAULTULID',
      name: 'Data Vault Task 3',
      description: 'Test Description',
      sourceLocationArn: 'sourceLocationArn',
      destinationLocationArn: 'destinationLocationArn',
      taskArn: 'taskArn',
      destinationFolder: 'DATAVAULTULID/dummyprefix',
      deleted: false,
    };

    await createDataVaultTask(dataVaultTask1Input, repositoryProvider);
    await createDataVaultTask(dataVaultTask2Input, repositoryProvider);

    const dataVaultTasks: Paged<DeaDataVaultTask> = await listDataVaultTasks(
      repositoryProvider,
      'DATAVAULTULID',
      undefined
    );

    expect(dataVaultTasks).toBeDefined();
    expect(dataVaultTasks.length).toEqual(3);
  });

  it('should list only 1 data vault task', async () => {
    const dataVaultTasks: Paged<DeaDataVaultTask> = await listDataVaultTasks(
      repositoryProvider,
      'DATAVAULTULID',
      undefined,
      1
    );

    expect(dataVaultTasks).toBeDefined();
    expect(dataVaultTasks.length).toEqual(1);
  });
});
