/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVaultFileDetails } from '../../../app/resources/get-data-vault-file-details';
import { DeaDataVaultInput } from '../../../models/data-vault';
import { DataVaultFileDTO, DeaDataVaultFile } from '../../../models/data-vault-file';
import { DeaUser } from '../../../models/user';
import { createDataVault } from '../../../persistence/data-vault';
import { createDataVaultFile } from '../../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let user: DeaUser;

describe('test data vault file details', () => {
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

  it('should create a data vault file and fetch the details', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 1',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const fileInput: DataVaultFileDTO = {
      fileName: 'testFile',
      filePath: '/dummypath/test/test/',
      dataVaultUlid: createdDataVault.ulid,
      isFile: true,
      fileSizeBytes: 1024,
      createdBy: user.ulid,
      contentType: 'regular',
      sha256Hash: 'SHA256HASH',
      versionId: 'VERSIONID',
      fileS3Key: 'S3KEY',
      executionId: 'exec-00000000000000000',
    };

    const dataVaultFile = await createDataVaultFile(fileInput, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault.ulid,
        fileId: dataVaultFile.ulid,
      },
    });

    const response = await getDataVaultFileDetails(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const retrievedDataVaultFile: DeaDataVaultFile = JSON.parse(response.body);

    expect(dataVaultFile.ulid).toEqual(retrievedDataVaultFile.ulid);
    expect(dataVaultFile.dataVaultUlid).toEqual(retrievedDataVaultFile.dataVaultUlid);
    expect(dataVaultFile.fileName).toEqual(retrievedDataVaultFile.fileName);
    expect(dataVaultFile.executionId).toEqual(retrievedDataVaultFile.executionId);
    expect(retrievedDataVaultFile.createdBy).toEqual(`${user.firstName} ${user.lastName}`);
  });

  it('should fail when missing data vault ulid', async () => {
    const event = getDummyEvent({});

    await expect(getDataVaultFileDetails(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'dataVaultId' is missing."
    );
  });

  it('should fail when missing file ulid', async () => {
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });

    await expect(getDataVaultFileDetails(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'fileId' is missing."
    );
  });

  it('should fail when provided with a file ulid that does not exist', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 2',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const dummyFileUlid = 'AAAAAAAAAAAAAAAAAAAAAAAAAA';
    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: createdDataVault.ulid,
        fileId: dummyFileUlid,
      },
    });

    await expect(getDataVaultFileDetails(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Could not find file: ${dummyFileUlid} in the DB`
    );
  });
});
