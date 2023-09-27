/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultExecution } from '../../models/data-vault-execution';
import { DeaUser } from '../../models/user';
import { createDataVaultExecution, listDataVaultExecutions } from '../../persistence/data-vault-execution';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { getTestRepositoryProvider } from './local-db-table';

let user: DeaUser;
const taskId = 'task-00000000000000000';

describe('data vault executions persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultExecutionsTestsTable');

    // create user
    user =
      (await createUser(
        {
          tokenId: 'FirstsixLastsix',
          idPoolId: 'FirstsixLastsixidentityid',
          firstName: 'Firstsix',
          lastName: 'Lastsix',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create a data vault execution', async () => {
    const execId = 'exec-00000000000000000';

    const dataVaultExecution: DeaDataVaultExecution = {
      taskId: taskId,
      executionId: execId,
      createdBy: user.ulid,
    };

    const createdDataVaultExecution = await createDataVaultExecution(dataVaultExecution, repositoryProvider);

    expect(createdDataVaultExecution).toBeDefined();
    expect(createdDataVaultExecution.executionId).toBe(execId);
    expect(createdDataVaultExecution.taskId).toBe(taskId);
  });

  it('should list first page of data vault executions for a specific task', async () => {
    const dataVaultExecution1: DeaDataVaultExecution = {
      taskId: taskId,
      executionId: 'exec-testId1',
      createdBy: user.ulid,
    };

    const dataVaultExecution2: DeaDataVaultExecution = {
      taskId: taskId,
      executionId: 'exec-testId2',
      createdBy: user.ulid,
    };

    await createDataVaultExecution(dataVaultExecution1, repositoryProvider);
    await createDataVaultExecution(dataVaultExecution2, repositoryProvider);

    const dataVaultExecutions: Paged<DeaDataVaultExecution> = await listDataVaultExecutions(
      repositoryProvider,
      taskId,
      undefined
    );

    expect(dataVaultExecutions).toBeDefined();
    expect(dataVaultExecutions.length).toEqual(3);
  });

  it('should list only 1 data vault execution', async () => {
    const dataVaultExecutions: Paged<DeaDataVaultExecution> = await listDataVaultExecutions(
      repositoryProvider,
      taskId,
      undefined,
      1
    );

    expect(dataVaultExecutions).toBeDefined();
    expect(dataVaultExecutions.length).toEqual(1);
  });
});
