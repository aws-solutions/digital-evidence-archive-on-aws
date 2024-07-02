/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { getDataVault } from '../../../app/resources/get-data-vault-details';
import { DeaDataVault, DeaDataVaultInput } from '../../../models/data-vault';
import { dataVaultResponseSchema } from '../../../models/validation/data-vault';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createDataVault } from '../../../persistence/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let testProviders: LambdaProviders;

describe('get dataVault details resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getDataVaultDetailsTest');
    testProviders = createTestProvidersObject({ repositoryProvider });
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should retrieve a dataVault', async () => {
    const theDataVault: DeaDataVaultInput = {
      name: 'ADataVaultForRetrieving',
      description: 'An initial description',
    };
    const createdDataVault = await createDataVault(theDataVault, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault.ulid,
      },
    });

    const response = await getDataVault(event, dummyContext, testProviders);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const retrievedDataVault: DeaDataVault = jsonParseWithDates(response.body);

    Joi.assert(retrievedDataVault, dataVaultResponseSchema);
    expect(retrievedDataVault.ulid).toEqual(createdDataVault.ulid);
    expect(retrievedDataVault.name).toEqual(theDataVault.name);
    expect(retrievedDataVault.description).toEqual(theDataVault.description);
  });

  it('should throw an error if the requested dataVault does not exist', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: ulid,
      },
    });

    await expect(getDataVault(event, dummyContext, testProviders)).rejects.toThrow(NotFoundError);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getDataVault(getDummyEvent(), dummyContext, testProviders)).rejects.toThrow(ValidationError);
  });
});
