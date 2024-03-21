/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { createDataVault } from '../../../app/resources/create-data-vault';
import { createDataVaultExecution } from '../../../app/resources/create-data-vault-execution';
import { createDataVaultTask } from '../../../app/resources/create-data-vault-task';
import { createS3Location } from '../../../app/services/data-sync-service';
import { DeaDataVaultExecution } from '../../../models/data-vault-execution';
import { DeaDataVaultTask } from '../../../models/data-vault-task';
import { DeaUser } from '../../../models/user';
import { dataVaultExecutionResponseSchema } from '../../../models/validation/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { DataSyncProvider, defaultDataSyncProvider } from '../../../storage/dataSync';
import { getDummyEvent, dummyContext } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let user: DeaUser;
let newTask: DeaDataVaultTask;

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

describe('create data vault execution resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createDataVaultExecutionTest');

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

  it('should successfully create a data vault execution', async () => {
    const name = 'testDataVault';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, repositoryProvider);
    const newDataVault = await JSON.parse(response.body);

    // Create source location arn
    const locationArn1 = await createS3Location(
      `/DATAVAULT${newDataVault.ulid}/locationtest1`,
      dataSyncProvider
    );

    const taskEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        name: 'testTask',
        sourceLocationArn: locationArn1,
        destinationFolder: 'testbucket',
      }),
    });

    const taskResponse = await createDataVaultTask(taskEvent, dummyContext, repositoryProvider);
    newTask = JSON.parse(taskResponse.body);

    const taskArn = newTask.taskArn;
    const taskId = newTask.taskId;

    const executionEvent = getDummyEvent({
      pathParameters: {
        taskId,
      },
      body: JSON.stringify({
        taskArn,
      }),
    });
    executionEvent.headers['userUlid'] = user.ulid;

    const executionResponse = await createDataVaultExecution(
      executionEvent,
      dummyContext,
      repositoryProvider
    );

    const dataVaultExecution = await validateAndReturnDataVaultExecution(taskId, executionResponse);

    expect(response.statusCode).toEqual(200);
    expect(dataVaultExecution.executionId).toBeDefined();
  });

  async function validateAndReturnDataVaultExecution(taskId: string, response: APIGatewayProxyResult) {
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const newDataVaultExecution: DeaDataVaultExecution = JSON.parse(response.body);

    Joi.assert(newDataVaultExecution, dataVaultExecutionResponseSchema);

    expect(newDataVaultExecution.taskId).toEqual(taskId);
    return newDataVaultExecution;
  }

  it('should fail when data vault task id is not valid', async () => {
    const executionEvent = getDummyEvent({
      pathParameters: {
        taskId: 'task-00000000000000000',
      },
      body: JSON.stringify({
        taskArn: newTask.taskArn,
      }),
    });
    executionEvent.headers['userUlid'] = user.ulid;

    await expect(createDataVaultExecution(executionEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested task ID does not match resource'
    );
  });

  it('should fail when a data vault task id and arn is missing', async () => {
    const event = getDummyEvent({});
    await expect(createDataVaultExecution(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Execute Data Vault Task payload missing.'
    );
  });
});
