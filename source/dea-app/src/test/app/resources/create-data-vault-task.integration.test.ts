/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { createDataVault } from '../../../app/resources/create-data-vault';
import { createDataVaultTask } from '../../../app/resources/create-data-vault-task';
import { createS3Location } from '../../../app/services/data-sync-service';
import { DeaDataVault } from '../../../models/data-vault';
import { DeaDataVaultTask } from '../../../models/data-vault-task';
import { dataVaultResponseSchema, dataVaultTaskResponseSchema } from '../../../models/validation/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { DataSyncProvider, defaultDataSyncProvider } from '../../../storage/dataSync';
import { getDummyEvent, dummyContext } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let newDataVault: DeaDataVault;
let locationArn1: string;
const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

describe('create data vault tasks resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createDataVaultTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully create a data vault task', async () => {
    const name = 'testDataVault';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, repositoryProvider);
    newDataVault = await validateAndReturnDataVault(name, response);

    // Create source location arn
    locationArn1 = await createS3Location(`/DATAVAULT${newDataVault.ulid}/locationtest1`, dataSyncProvider);

    const event2 = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        name: 'testTask',
        sourceLocationArn: locationArn1,
        destinationFolder: 'testbucket',
      }),
    });

    const response2 = await createDataVaultTask(event2, dummyContext, repositoryProvider);

    const dataVaultTask = await validateAndReturnDataVaultTask('testTask', newDataVault.ulid, response2);

    expect(response.statusCode).toEqual(200);
    expect(dataVaultTask.dataVaultUlid).toBeDefined();
  });

  it('should fail when a data vault task name is already in use', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        name: 'testTask',
        sourceLocationArn: locationArn1,
        destinationFolder: 'testbucket',
      }),
    });

    await expect(createDataVaultTask(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Data Vault task name is already in use'
    );
  });

  it('should fail when a data vault task is missing a name', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        sourceLocationArn: locationArn1,
        destinationFolder: 'testbucket',
      }),
    });

    await expect(createDataVaultTask(event, dummyContext, repositoryProvider)).rejects.toThrow(
      '"name" is required'
    );
  });

  it('should fail when data vault task is missing a valid source location', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        name: 'newname',
        sourceLocationArn: 'dummylocationarn',
        destinationFolder: 'testbucket',
      }),
    });

    await expect(createDataVaultTask(event, dummyContext, repositoryProvider)).rejects.toThrow(
      '"sourceLocationArn" length must be at least 20 characters long'
    );
  });

  async function validateAndReturnDataVault(name: string, response: APIGatewayProxyResult) {
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const newDataVault: DeaDataVault = JSON.parse(response.body);

    Joi.assert(newDataVault, dataVaultResponseSchema);

    expect(newDataVault.name).toEqual(name);
    return newDataVault;
  }

  async function validateAndReturnDataVaultTask(
    name: string,
    dataVaultId: string,
    response: APIGatewayProxyResult
  ) {
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const newDataVaultTask: DeaDataVaultTask = JSON.parse(response.body);

    Joi.assert(newDataVaultTask, dataVaultTaskResponseSchema);

    expect(newDataVaultTask.dataVaultUlid).toEqual(dataVaultId);
    expect(newDataVaultTask.name).toEqual(name);
    return newDataVaultTask;
  }
});
