/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { OneTableError } from 'dynamodb-onetable';
import Joi from 'joi';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { updateDataVault } from '../../../app/resources/update-data-vault';
import { DeaDataVault, DeaDataVaultInput } from '../../../models/data-vault';
import { dataVaultResponseSchema } from '../../../models/validation/data-vault';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createDataVault } from '../../../persistence/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let testProviders: LambdaProviders;

describe('update dataVaults resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('updateDataVaultTest');
    testProviders = createTestProvidersObject({ repositoryProvider });
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully update a dataVault description and name', async () => {
    const updatedDescription = 'An Updated Description';
    const updatedName = 'AnUpdatedDataVault';
    const theDataVault: DeaDataVaultInput = {
      name: 'ADataVaultForUpdating',
      description: 'An initial description',
    };
    const createdDataVault = await createDataVault(theDataVault, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault.ulid,
      },
      body: JSON.stringify({
        ulid: createdDataVault.ulid,
        name: updatedName,
        description: updatedDescription,
      }),
    });

    const response = await updateDataVault(event, dummyContext, testProviders);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const updatedDataVault: DeaDataVault = jsonParseWithDates(response.body);

    Joi.assert(updatedDataVault, dataVaultResponseSchema);
    if (!updatedDataVault.updated || !createdDataVault.updated) {
      fail();
    }

    expect(updatedDataVault.updated.getTime()).toBeGreaterThan(createdDataVault.updated.getTime());
    expect(updatedDataVault).toEqual({
      ...createdDataVault,
      name: updatedName,
      updated: updatedDataVault.updated,
      description: updatedDescription,
    });
  });

  it('should error if path and payload do not match', async () => {
    const ulid1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const ulid2 = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: ulid1,
      },
      body: JSON.stringify({
        ulid: ulid2,
        name: 'ThisWillNotWork',
        description: 'these are words',
      }),
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      'Requested DataVault Ulid does not match resource'
    );
  });

  it('should error if no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: null,
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      'Update Data Vault payload missing.'
    );
  });

  it('should error if payload does include valid JSON', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: {
        invalidJSON: 'invalidJSON',
        invalidJSON2: 'invalidJSON2',
      },
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      'Update Data Vault payload is malformed. Failed to parse.'
    );
  });

  it('should error if a path parameter specifying dataVaultId is not found', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      body: JSON.stringify({
        ulid: ulid,
        name: 'ThisWillNotWork',
        description: 'these are words',
      }),
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      "Required path param 'dataVaultId' is missing."
    );
  });

  it('should not allow update of objectCount', async () => {
    const theDataVault: DeaDataVaultInput = {
      name: 'DataVaultCountCheck',
      description: 'An initial description',
    };
    const createdDataVault = await createDataVault(theDataVault, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault.ulid,
      },
      body: JSON.stringify({
        ulid: createdDataVault.ulid,
        name: 'DataVaultCountCheck',
        objectCount: 5,
        description: 'description',
      }),
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      '"objectCount" is not allowed'
    );
  });

  it('should error when updating a non-existant record', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: ulid,
      },
      body: JSON.stringify({
        ulid: ulid,
        name: 'ThisWillNotWork',
        description: 'these are words',
      }),
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(OneTableError);
  });

  it('should error when updating to a name in use', async () => {
    const theDataVault1: DeaDataVaultInput = {
      name: 'TheFirstDataVault',
      description: 'An initial description',
    };
    const theDataVault2: DeaDataVaultInput = {
      name: 'TheSecondDataVault',
      description: 'An initial description',
    };
    const createdDataVault1 = await createDataVault(theDataVault1, repositoryProvider);
    const createdDataVault2 = await createDataVault(theDataVault2, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault1.ulid,
      },
      body: JSON.stringify({
        ulid: createdDataVault1.ulid,
        name: createdDataVault2.name,
        description: 'whatevs',
      }),
    });

    await expect(updateDataVault(event, dummyContext, testProviders)).rejects.toThrow(
      'Data Vault name is already in use'
    );
  });

  it('should update succesfully to a name that was previously, but is no longer in use', async () => {
    const aNewNameForDataVault1 = 'TheFirstDataVaultButMore';
    const theDataVault1: DeaDataVaultInput = {
      name: 'TheFirstDataVaultA',
      description: 'An initial description',
    };
    const theDataVault2: DeaDataVaultInput = {
      name: 'TheSecondDataVaultB',
      description: 'An initial description',
    };
    const createdDataVault1 = await createDataVault(theDataVault1, repositoryProvider);
    const createdDataVault2 = await createDataVault(theDataVault2, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault1.ulid,
      },
      body: JSON.stringify({
        ulid: createdDataVault1.ulid,
        name: aNewNameForDataVault1,
        description: 'whatevs',
      }),
    });

    const response = await updateDataVault(event, dummyContext, testProviders);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const updatedDataVault1: DeaDataVault = jsonParseWithDates(response.body);
    expect(updatedDataVault1.name).toEqual(aNewNameForDataVault1);

    const event2 = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault2.ulid,
      },
      body: JSON.stringify({
        ulid: createdDataVault2.ulid,
        name: theDataVault1.name,
        description: 'whatevs',
      }),
    });

    const response2 = await updateDataVault(event2, dummyContext, testProviders);

    expect(response2.statusCode).toEqual(200);

    if (!response2.body) {
      fail();
    }

    const updatedDataVault2: DeaDataVault = jsonParseWithDates(response2.body);
    expect(updatedDataVault2.name).toEqual(theDataVault1.name);
  });
});
