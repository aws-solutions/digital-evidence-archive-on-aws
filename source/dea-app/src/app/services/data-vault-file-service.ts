/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import * as DataVaultFilePersistence from '../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getUsers } from '../../persistence/user';

export const listDataVaultFilesByFilePath = async (
  dataVaultId: string,
  filePath: string,
  limit = 30,
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined
): Promise<Paged<DeaDataVaultFile>> => {
  return await DataVaultFilePersistence.listDataVaultFilesByFilePath(
    dataVaultId,
    filePath,
    limit,
    repositoryProvider,
    nextToken
  );
};

export const getDataVaultFile = async (
  dataVaultId: string,
  ulid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile | undefined> => {
  return await DataVaultFilePersistence.getDataVaultFileByUlid(ulid, dataVaultId, repositoryProvider);
};

export const hydrateUsersForDataVaultFiles = async (
  files: DeaDataVaultFile[],
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile[]> => {
  // get all unique user ulids referenced on the files
  const userUlids = [...new Set(files.map((file) => file.createdBy))];
  // fetch the users
  const userMap = await getUsers(userUlids, repositoryProvider);

  // Update createdBy with usernames
  return files.map((file) => {
    const user = userMap.get(file.createdBy);
    let createdBy = file.createdBy;
    if (user) {
      createdBy = `${user?.firstName} ${user?.lastName}`;
    }
    return {
      ulid: file.ulid,
      fileName: file.fileName,
      filePath: file.filePath,
      dataVaultUlid: file.dataVaultUlid,
      isFile: file.isFile,
      fileSizeBytes: file.fileSizeBytes,
      createdBy,
      contentType: file.contentType,
      sha256Hash: file.sha256Hash,
      versionId: file.versionId,
      fileS3Key: file.fileS3Key,
      executionId: file.executionId,
      created: file.created,
      updated: file.updated,
    };
  });
};
