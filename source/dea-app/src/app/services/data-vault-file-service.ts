/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Paged } from 'dynamodb-onetable';
import { ScopedDeaCase } from '../../models/case';
import { DeaCaseFile, DeaCaseFileResult } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import { getCases } from '../../persistence/case';
import { listCasesByFile } from '../../persistence/case-file';
import * as DataVaultFilePersistence from '../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getUsers } from '../../persistence/user';
import { NotFoundError } from '../exceptions/not-found-exception';
import * as CaseFileService from '../services/case-file-service';

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

export const fetchNestedFilesInFolders = async (
  dataVaultId: string,
  fileUlids: string[],
  limit = 30,
  repositoryProvider: ModelRepositoryProvider
): Promise<string[]> => {
  const fileUlidsStack = [...fileUlids];
  const completeFileUlids = [];

  while (fileUlidsStack.length > 0) {
    const fileUlid = fileUlidsStack.pop();

    if (!fileUlid) {
      break;
    }

    const retrievedDataVaultFile = await getDataVaultFile(dataVaultId, fileUlid, repositoryProvider);
    if (!retrievedDataVaultFile) {
      throw new NotFoundError(`Could not find file: ${fileUlid} in DataVault: ${dataVaultId} in the DB`);
    }

    // Handle nested folders
    if (!retrievedDataVaultFile.isFile) {
      let nextToken = undefined;
      do {
        const pageOfDataVaultFiles: Paged<DeaDataVaultFile> =
          await DataVaultFilePersistence.listDataVaultFilesByFilePath(
            dataVaultId,
            `${retrievedDataVaultFile.filePath}${retrievedDataVaultFile.fileName}/`,
            limit,
            repositoryProvider,
            nextToken
          );
        const nestedFiles = pageOfDataVaultFiles.map((file) => file.ulid);
        fileUlidsStack.push(...nestedFiles);
        nextToken = pageOfDataVaultFiles.next;
      } while (nextToken);
    } else {
      completeFileUlids.push(retrievedDataVaultFile.ulid);
    }
  }
  return completeFileUlids;
};

export const associateFilesListToCase = async (
  dataVaultId: string,
  userUlid: string,
  caseUlids: string[],
  fileUlids: string[],
  repositoryProvider: ModelRepositoryProvider
) => {
  const filesTransferred = [];
  for (const caseUlid of caseUlids) {
    for (const fileUlid of fileUlids) {
      const retrievedDataVaultFile = await getDataVaultFile(dataVaultId, fileUlid, repositoryProvider);
      if (!retrievedDataVaultFile) {
        throw new NotFoundError(`Could not find file: ${fileUlid} in DataVault: ${dataVaultId} in the DB`);
      }

      const caseFileEntry: DeaCaseFile = {
        ulid: retrievedDataVaultFile.ulid,
        caseUlid: caseUlid,
        fileName: retrievedDataVaultFile.fileName,
        contentType: retrievedDataVaultFile.contentType,
        createdBy: retrievedDataVaultFile.createdBy,
        filePath: retrievedDataVaultFile.filePath,
        fileSizeBytes: retrievedDataVaultFile.fileSizeBytes,
        sha256Hash: retrievedDataVaultFile.sha256Hash,
        versionId: retrievedDataVaultFile.versionId,
        isFile: retrievedDataVaultFile.isFile,
        status: CaseFileStatus.ACTIVE,
        fileS3Key: retrievedDataVaultFile.fileS3Key,

        //Data Vault Params
        dataVaultUlid: retrievedDataVaultFile.dataVaultUlid,
        associationCreatedBy: userUlid,
        executionId: retrievedDataVaultFile.executionId,
      };

      const completeCaseAssociationResponse = await CaseFileService.createCaseAssociation(
        caseFileEntry,
        repositoryProvider
      );
      filesTransferred.push(completeCaseAssociationResponse);
    }
  }

  return filesTransferred;
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
      caseCount: file.caseCount,
    };
  });
};

export const hydrateDataVaultFile = async (
  file: DeaDataVaultFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile> => {
  // hydrate the user.
  const hydratedFiles = await hydrateUsersForDataVaultFiles([file], repositoryProvider);

  // Get's the cases associated to the file
  const caseUlids: string[] = [];
  let nextToken = undefined;
  do {
    const caseFilePage: Paged<DeaCaseFileResult> = await listCasesByFile(
      file.ulid,
      repositoryProvider,
      nextToken
    );
    caseUlids.push(...caseFilePage.map((caseFile) => caseFile.caseUlid));
    nextToken = caseFilePage.next;
  } while (nextToken);

  // fetch the cases
  const caseMap = await getCases(caseUlids, repositoryProvider);
  const cases: ScopedDeaCase[] = caseUlids.map((caseUlid) => {
    const deaCase = caseMap.get(caseUlid);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      ulid: deaCase?.ulid,
      name: deaCase?.name,
    } as ScopedDeaCase;
  });

  return { ...hydratedFiles[0], cases };
};
