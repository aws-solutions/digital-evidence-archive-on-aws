/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { listDataVaultFiles } from '../../../app/resources/list-data-vault-files';
import { DeaDataVaultInput } from '../../../models/data-vault';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import { DeaUser } from '../../../models/user';
import { createDataVault } from '../../../persistence/data-vault';
import { createDataVaultFile } from '../../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { dataVaultFileGenerate } from './data-vault-integration-test-helper';

let user: DeaUser;

describe('data vault file persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultFileTestsTable');
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

  it('should list data vault files by data vault ID', async () => {
    const testPath1 = '/dummypath/';
    const testPath2 = '/dummypath/folder2/';
    const filesList1Count = 5;
    const filesList2Count = 10;

    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 1',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const filesList1 = dataVaultFileGenerate(filesList1Count, testPath1, createdDataVault.ulid, user.ulid);
    const filesList2 = dataVaultFileGenerate(filesList2Count, testPath2, createdDataVault.ulid, user.ulid);

    for (const file of filesList1) {
      await createDataVaultFile(file, repositoryProvider);
    }

    for (const file of filesList2) {
      await createDataVaultFile(file, repositoryProvider);
    }

    const response1 = await listDataVaultFiles(
      getDummyEvent({
        pathParameters: {
          dataVaultId: createdDataVault.ulid,
        },
        queryStringParameters: {
          filePath: testPath1,
        },
      }),
      dummyContext,
      repositoryProvider
    );
    const dataVaultFiles1: DeaDataVaultFile[] = JSON.parse(response1.body).files;
    expect(dataVaultFiles1.length).toEqual(filesList1Count);

    const response2 = await listDataVaultFiles(
      getDummyEvent({
        pathParameters: {
          dataVaultId: createdDataVault.ulid,
        },
        queryStringParameters: {
          filePath: testPath2,
        },
      }),
      dummyContext,
      repositoryProvider
    );
    const dataVaultFiles2: DeaDataVaultFile[] = JSON.parse(response2.body).files;
    expect(dataVaultFiles2.length).toEqual(filesList2Count);

    const response3 = await listDataVaultFiles(
      getDummyEvent({
        pathParameters: {
          dataVaultId: createdDataVault.ulid,
        },
        queryStringParameters: {
          filePath: '/',
        },
      }),
      dummyContext,
      repositoryProvider
    );
    const dataVaultFilesRoot: DeaDataVaultFile[] = JSON.parse(response3.body).files;
    expect(dataVaultFilesRoot.length).toEqual(0);
  }, 40000);

  it('should fail for a data vault id that does not exist', async () => {
    const dataVaultId = '000000000000AAAAAAAAAAAAAA';
    await expect(
      listDataVaultFiles(
        getDummyEvent({
          pathParameters: {
            dataVaultId,
          },
          queryStringParameters: {
            filePath: '/',
          },
        }),
        dummyContext,
        repositoryProvider
      )
    ).rejects.toThrow(`Could not find DataVault: ${dataVaultId} in the DB`);
  }, 40000);

  it('should fail for a missing data vault id', async () => {
    await expect(listDataVaultFiles(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'dataVaultId' is missing."
    );
  }, 40000);
});
