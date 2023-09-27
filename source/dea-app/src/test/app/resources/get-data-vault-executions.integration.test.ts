/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createDataVault } from '../../../app/resources/create-data-vault';
import { createDataVaultExecution } from '../../../app/resources/create-data-vault-execution';
import { createDataVaultTask } from '../../../app/resources/create-data-vault-task';
import { getDataVaultExecutions } from '../../../app/resources/get-data-vault-executions';
import { createS3Location } from '../../../app/services/data-sync-service';
import { DeaDataVaultExecution } from '../../../models/data-vault-execution';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { DataSyncProvider, defaultDataSyncProvider } from '../../../storage/dataSync';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let user: DeaUser;

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

describe('get data vault executions', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getDataVaultExecutionsTest');

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

  it('should return data vault executions for a given data vault task Id', async () => {
    const dataVaultTaskName = 'testDataVault1';

    // Create multiple data vault for testing
    const dataVaultResponse = await createDataVault(
      getDummyEvent({
        body: JSON.stringify({
          name: 'test',
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    const newDataVault = JSON.parse(dataVaultResponse.body);

    // Create source location arn
    const locationArn1 = await createS3Location(
      `/DATAVAULT${newDataVault.ulid}/locationtest1`,
      dataSyncProvider
    );

    const taskResponse = await createDataVaultTask(
      getDummyEvent({
        pathParameters: {
          dataVaultId: newDataVault.ulid,
        },
        body: JSON.stringify({
          name: dataVaultTaskName,
          sourceLocationArn: locationArn1,
          destinationFolder: 'testbucket',
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    const newTask = JSON.parse(taskResponse.body);

    const taskArn = newTask.taskArn;
    const taskId = newTask.taskId;

    const event = getDummyEvent({
      pathParameters: {
        taskId,
      },
      body: JSON.stringify({
        taskArn,
      }),
    });
    event.headers['userUlid'] = user.ulid;

    const executionResponse = await createDataVaultExecution(event, dummyContext, repositoryProvider);
    const newExecution = JSON.parse(executionResponse.body);

    // Get executions for a given task id
    const executionListResponse = await getDataVaultExecutions(
      getDummyEvent({
        pathParameters: {
          taskId,
        },
      }),
      dummyContext,
      repositoryProvider
    );
    const dataVaultExecutions: DeaDataVaultExecution[] = JSON.parse(
      executionListResponse.body
    ).dataVaultExecutions;
    expect(dataVaultExecutions.length).toEqual(1);
    expect(dataVaultExecutions[0].executionId).toEqual(newExecution.executionId);
  });

  it('should fail to return if task ID is missing', async () => {
    const event = getDummyEvent({});
    await expect(getDataVaultExecutions(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'taskId' is missing."
    );
  });
});
