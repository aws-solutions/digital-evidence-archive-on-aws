/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as DataVaultService from '../../../app/services/data-vault-service';
import { DeaDataVault } from '../../../models/data-vault';
import { DataVaultFileDTO } from '../../../models/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';

export const callCreateDataVault = async (
  repositoryProvider: ModelRepositoryProvider,
  name: string,
  description: string
): Promise<DeaDataVault> => {
  return await DataVaultService.createDataVault({ name, description }, repositoryProvider);
};

export const dataVaultFileGenerate = (
  count: number,
  filePath: string,
  dataVaultUlid: string,
  userUlid: string
): DataVaultFileDTO[] => {
  const dataVaultFiles: DataVaultFileDTO[] = [];

  for (let i = 1; i <= count; i++) {
    const fileInput: DataVaultFileDTO = {
      fileName: `testFile${i}`,
      filePath: filePath,
      dataVaultUlid: dataVaultUlid,
      isFile: true,
      fileSizeBytes: 1024,
      createdBy: userUlid,
      contentType: 'regular',
      sha256Hash: 'SHA256HASH',
      versionId: 'VERSIONID',
      fileS3Key: 'S3KEY',
      executionId: 'exec-00000000000000000',
    };

    dataVaultFiles.push(fileInput);
  }

  return dataVaultFiles;
};

export const dataVaultFolderGenerate = (
  folderName: string,
  filePath: string,
  dataVaultUlid: string,
  userUlid: string
): DataVaultFileDTO => {
  const fileInput: DataVaultFileDTO = {
    fileName: folderName,
    filePath: filePath,
    dataVaultUlid: dataVaultUlid,
    isFile: false,
    fileSizeBytes: 0,
    createdBy: userUlid,
    contentType: 'Directory',
    sha256Hash: 'SHA256HASH',
    versionId: 'VERSIONID',
    fileS3Key: 'S3KEY',
    executionId: 'exec-00000000000000000',
  };

  return fileInput;
};
