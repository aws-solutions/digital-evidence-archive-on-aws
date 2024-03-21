/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultInput, DeaDataVault } from '../../models/data-vault';
import { createDataVault, getDataVault, listDataVaults, updateDataVault } from '../../persistence/data-vault';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getTestRepositoryProvider } from './local-db-table';

describe('data vault persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let testDataVault: DeaDataVault;
  let dataVaultUlid: string;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultTestsTable');

    testDataVault =
      (await createDataVault({ name: 'TheDataVault', description: 'TheDescription' }, repositoryProvider)) ??
      fail();
    dataVaultUlid = testDataVault.ulid ?? fail();
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
    expect(dataVaults.length).toEqual(4);
  });

  it('should list only 1 data vault', async () => {
    const dataVaults: Paged<DeaDataVault> = await listDataVaults(repositoryProvider, undefined, 1);
    expect(dataVaults).toBeDefined();
    expect(dataVaults.length).toEqual(1);
  });

  it('should return undefined if a data vault is not found', async () => {
    const currentDataVault = await getDataVault('bogus', repositoryProvider);

    expect(currentDataVault).toBeUndefined();
  });

  it('should get a data vault by id', async () => {
    const currentDataVault = await getDataVault(dataVaultUlid, repositoryProvider);

    expect(currentDataVault).toEqual(testDataVault);
  });

  it('should create a data vault, get and update it', async () => {
    const currentTestDataVault: DeaDataVaultInput = {
      name: 'DataVault Wars',
      description: 'In a PD far far away',
    };

    const createdDataVault = await createDataVault(currentTestDataVault, repositoryProvider);

    const readDataVault = await getDataVault(createdDataVault?.ulid ?? 'bogus', repositoryProvider);

    const dataVaultCheck: DeaDataVault = {
      ulid: createdDataVault?.ulid,
      created: createdDataVault?.created,
      updated: createdDataVault?.updated,
      objectCount: 0,
      totalSizeBytes: 0,
      ...currentTestDataVault,
    };
    expect(readDataVault).toEqual(dataVaultCheck);

    // Update dataVault
    const updateTestDataVault: DeaDataVault = {
      ulid: createdDataVault?.ulid,
      name: 'DataVault Wars7',
      objectCount: 0,
      totalSizeBytes: 0,
      description: 'The first 6 were better',
    };

    const updatedDataVault = await updateDataVault(updateTestDataVault, repositoryProvider);

    const updateCheck: DeaDataVault = {
      ...updateTestDataVault,
      objectCount: updatedDataVault?.objectCount,
      totalSizeBytes: 0,
      created: createdDataVault?.created,
      updated: updatedDataVault?.updated,
    };

    expect(updatedDataVault).toEqual(updateCheck);
  });
});
