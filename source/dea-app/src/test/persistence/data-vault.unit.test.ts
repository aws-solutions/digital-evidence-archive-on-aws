/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultInput, DeaDataVault } from '../../models/data-vault';
import { createDataVault, listDataVaults } from '../../persistence/data-vault';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getTestRepositoryProvider } from './local-db-table';

describe('data vault persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultTestsTable');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create a data vault', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 1',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    expect(createdDataVault).toBeDefined();
    expect(createdDataVault.name).toBe(dataVaultInput.name);
    expect(createdDataVault.description).toBe(dataVaultInput.description);
  });

  it('should list the first page of data vaults', async () => {
    const dataVault1Input: DeaDataVaultInput = {
      name: 'Data Vault 2',
      // Testing optional/no description
    };

    const dataVault2Input: DeaDataVaultInput = {
      name: 'Data Vault 3',
      description: 'Test Description',
    };

    await createDataVault(dataVault1Input, repositoryProvider);
    await createDataVault(dataVault2Input, repositoryProvider);

    const dataVaults: Paged<DeaDataVault> = await listDataVaults(repositoryProvider, undefined);

    expect(dataVaults).toBeDefined();
    expect(dataVaults.length).toEqual(3);
  });

  it('should list only 1 data vault', async () => {
    const dataVaults: Paged<DeaDataVault> = await listDataVaults(repositoryProvider, undefined, 1);
    expect(dataVaults).toBeDefined();
    expect(dataVaults.length).toEqual(1);
  });
});
