/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVaultInput } from '../../models/data-vault';
import { DataVaultFileDTO } from '../../models/data-vault-file';
import { DeaUser } from '../../models/user';
import { createDataVault } from '../../persistence/data-vault';
import {
  createDataVaultFile,
  getDataVaultFileByUlid,
  listDataVaultFilesByFilePath,
} from '../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { getTestRepositoryProvider } from './local-db-table';

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

  it('should create a data vault file', async () => {
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

    const dataVaultFile = await createDataVaultFile([fileInput], repositoryProvider);

    expect(dataVaultFile).toBeDefined();
  });

  it('should create a data vault folder', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 2',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const fileInput: DataVaultFileDTO = {
      fileName: 'testFile',
      filePath: '/dummypath/',
      dataVaultUlid: createdDataVault.ulid,
      isFile: false,
      fileSizeBytes: 1024,
      createdBy: user.ulid,
      contentType: 'Directory',
      sha256Hash: 'SHA256HASH',
      versionId: 'VERSIONID',
      fileS3Key: 'S3KEY',
      executionId: 'exec-00000000000000000',
    };

    const dataVaultFolder = await createDataVaultFile([fileInput], repositoryProvider);

    expect(dataVaultFolder).toBeDefined();
  });

  it('should list data vault files', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 3',
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

    await createDataVaultFile([fileInput], repositoryProvider);
    const fileInput2: DataVaultFileDTO = {
      fileName: 'testFile2',
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

    await createDataVaultFile([fileInput2], repositoryProvider);

    const dataVaultFiles = await listDataVaultFilesByFilePath(
      createdDataVault.ulid,
      '/dummypath/test/test/',
      10000,
      repositoryProvider
    );

    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(2);
  });

  it('should list only 1 data vault file', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 4',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const fileInput: DataVaultFileDTO = {
      fileName: 'testFile1',
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

    await createDataVaultFile([fileInput], repositoryProvider);
    const fileInput2: DataVaultFileDTO = {
      fileName: 'testFile2',
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

    await createDataVaultFile([fileInput2], repositoryProvider);

    const dataVaultFiles = await listDataVaultFilesByFilePath(
      createdDataVault.ulid,
      '/dummypath/test/test/',
      1,
      repositoryProvider
    );

    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(1);
  });

  it('should get file details from data vault by ULID', async () => {
    const dataVaultInput: DeaDataVaultInput = {
      name: 'Data Vault 5',
      description: 'Test Description',
    };

    const createdDataVault = await createDataVault(dataVaultInput, repositoryProvider);

    const fileInput: DataVaultFileDTO = {
      fileName: 'testFile1',
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

    const fileResponse = await createDataVaultFile([fileInput], repositoryProvider);

    const fileDetail = await getDataVaultFileByUlid(
      fileResponse[0].ulid,
      createdDataVault.ulid,
      repositoryProvider
    );

    expect(fileDetail).toEqual(fileResponse[0]);
  });
});
