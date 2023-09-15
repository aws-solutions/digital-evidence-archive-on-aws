/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { createDataVault } from '../../../app/resources/create-data-vault';
import { DeaDataVault } from '../../../models/data-vault';
import { dataVaultResponseSchema } from '../../../models/validation/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('create data vaults resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createDataVaultTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully create a data vault', async () => {
    const name = 'testDataVault';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, repositoryProvider);
    const newDataVault = await validateAndReturnDataVault(name, response);
    return newDataVault.ulid ?? fail();
  });

  it('should fail to create a data vault when the provided name is already in use', async () => {
    const name = 'testDataVault2';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    await createDataVault(event, dummyContext, repositoryProvider);

    await expect(createDataVault(event, dummyContext, repositoryProvider)).rejects.toThrow();
  });

  it('should fail when no name is provided', async () => {
    const event = getDummyEvent({
      body: JSON.stringify({}),
    });
    await expect(createDataVault(event, dummyContext, repositoryProvider)).rejects.toThrow();
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
});
