/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createDataVault } from '../../../app/resources/create-data-vault';
import { getDataVaults } from '../../../app/resources/get-data-vaults';
import { DeaDataVault } from '../../../models/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';

import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('get data vaults', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getDataVaultsTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should return data vaults', async () => {
    const dataVaultName1 = 'testDataVault1';
    const dataVaultName2 = 'testDataVault2';
    const dataVaultName3 = 'testDataVault3';

    // Create multiple data vaults for testing
    await createDataVault(
      getDummyEvent({
        body: JSON.stringify({
          name: dataVaultName1,
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    await createDataVault(
      getDummyEvent({
        body: JSON.stringify({
          name: dataVaultName2,
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    await createDataVault(
      getDummyEvent({
        body: JSON.stringify({
          name: dataVaultName3,
        }),
      }),
      dummyContext,
      repositoryProvider
    );

    const event = getDummyEvent({});

    const response = await getDataVaults(event, dummyContext, repositoryProvider);
    const dataVaults: DeaDataVault[] = JSON.parse(response.body).dataVaults;
    expect(dataVaults.length).toEqual(3);
    expect(dataVaults.find((dataVault) => dataVault.name === dataVaultName1)).toBeDefined();
    expect(dataVaults.find((dataVault) => dataVault.name === dataVaultName2)).toBeDefined();
    expect(dataVaults.find((dataVault) => dataVault.name === dataVaultName3)).toBeDefined();
  });
});
