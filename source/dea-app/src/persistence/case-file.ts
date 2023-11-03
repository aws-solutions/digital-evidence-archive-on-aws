/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { logger } from '../logger';
import { DeaCaseFile, DeaCaseFileResult, InitiateCaseFileUploadDTO } from '../models/case-file';
import { CaseFileStatus } from '../models/case-file-status';
import { caseFileFromEntity } from '../models/projections';
import { S3Object } from '../storage/datasets';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider } from './schema/entities';

const SECONDS_IN_AN_HOUR = 60 * 60;

export const initiateCaseFileUpload = async (
  uploadDTO: InitiateCaseFileUploadDTO,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult> => {
  // strip out chunkSizeBytes before saving in dynamo-db
  const { chunkSizeBytes: _, ...deaCaseFile } = uploadDTO;
  const newEntity = await repositoryProvider.CaseFileModel.create({
    ...deaCaseFile,
    isFile: true,
    createdBy: userUlid,
    status: CaseFileStatus.PENDING,
    ttl: Math.round(Date.now() / 1000) + SECONDS_IN_AN_HOUR,
  });
  return caseFileFromEntity(newEntity);
};

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult> => {
  const transaction = {};
  const newEntity = await repositoryProvider.CaseFileModel.update(
    {
      ...deaCaseFile,
      status: CaseFileStatus.ACTIVE,
      ttl: null,
    },
    { transaction }
  );

  await repositoryProvider.CaseModel.update(
    {
      PK: `CASE#${deaCaseFile.caseUlid}#`,
      SK: 'CASE#',
    },
    {
      add: { objectCount: 1, totalSizeBytes: deaCaseFile.fileSizeBytes },
      transaction,
    }
  );

  await repositoryProvider.table.transact('write', transaction);
  await createCaseFilePaths(deaCaseFile, repositoryProvider);
  return caseFileFromEntity(newEntity);
};

export const createCaseFileAssociation = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult> => {
  const transaction = {};
  const newEntity = await repositoryProvider.CaseFileModel.create(
    {
      ...deaCaseFile,
    },
    { transaction }
  );

  if (deaCaseFile.isFile) {
    await repositoryProvider.CaseModel.update(
      {
        PK: `CASE#${deaCaseFile.caseUlid}#`,
        SK: 'CASE#',
      },
      {
        add: { objectCount: 1, totalSizeBytes: deaCaseFile.fileSizeBytes },
        transaction,
      }
    );
    await repositoryProvider.DataVaultFileModel.update(
      {
        PK: `DATAVAULT#${deaCaseFile.dataVaultUlid}#`,
        SK: `FILE#${deaCaseFile.ulid}#`,
      },
      {
        add: { caseCount: 1 },
        transaction,
      }
    );
  }

  await repositoryProvider.table.transact('write', transaction);
  await createCaseFilePaths(deaCaseFile, repositoryProvider);
  return caseFileFromEntity(newEntity);
};

export const getAllCaseFileS3Objects = async (
  caseId: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<S3Object[]> => {
  const items = await repositoryProvider.CaseFileModel.find(
    {
      PK: `CASE#${caseId}#`,
    },
    {
      fields: ['ulid', 'versionId'],
      where: '${isFile} = {true} AND ${status} <> {DELETED}',
    }
  );
  return items.map((item) => {
    return { key: `${caseId}/${item.ulid}`, versionId: item.versionId ?? '' };
  });
};

export const setCaseFileStatusDeleteFailed = async (
  casefile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
  const caseFileEntity = await repositoryProvider.CaseFileModel.update(
    {
      PK: `CASE#${casefile.caseUlid}#`,
      SK: `FILE#${casefile.ulid}#`,
    },
    {
      set: { status: CaseFileStatus.DELETE_FAILED },
    }
  );

  return caseFileEntity ? caseFileFromEntity(caseFileEntity) : caseFileEntity;
};

export const setCaseFileStatusDeleted = async (
  casefile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
  const transaction = {};
  const caseFileEntity = await repositoryProvider.CaseFileModel.update(
    {
      PK: `CASE#${casefile.caseUlid}#`,
      SK: `FILE#${casefile.ulid}#`,
    },
    {
      set: { status: CaseFileStatus.DELETED },
      transaction,
    }
  );

  await repositoryProvider.CaseModel.update(
    {
      PK: `CASE#${casefile.caseUlid}#`,
      SK: 'CASE#',
    },
    {
      add: { objectCount: -1, totalSizeBytes: -casefile.fileSizeBytes },
      transaction,
    }
  );
  await repositoryProvider.table.transact('write', transaction);
  return caseFileEntity ? caseFileFromEntity(caseFileEntity) : caseFileEntity;
};

const createCaseFilePaths = async (deaCaseFile: DeaCaseFile, repositoryProvider: ModelRepositoryProvider) => {
  const noTrailingSlashPath = deaCaseFile.filePath.substring(0, deaCaseFile.filePath.length - 1);
  if (noTrailingSlashPath.length > 0) {
    const nextFileName = noTrailingSlashPath.substring(
      noTrailingSlashPath.lastIndexOf('/') + 1,
      noTrailingSlashPath.length
    );
    const nextPath = noTrailingSlashPath.substring(0, noTrailingSlashPath.lastIndexOf('/') + 1);
    // write next
    const newFileObj = Object.assign(
      {},
      {
        ...deaCaseFile,
        fileName: nextFileName,
        filePath: nextPath,
        ulid: undefined,
        ttl: undefined,
      }
    );

    // if the path already exists, all parents will also exist, we can exit
    // only recurse if the path doesn't alredy exist
    try {
      await repositoryProvider.CaseFileModel.create({
        ...newFileObj,
        status: CaseFileStatus.ACTIVE,
        isFile: false,
      });
      await createCaseFilePaths(newFileObj, repositoryProvider);
    } catch (error) {
      if ('code' in error && error.code === 'UniqueError') {
        logger.debug(`Path ${newFileObj.filePath}/${newFileObj.fileName} already exists, moving on...`);
      } else {
        throw error;
      }
    }
  }
};

export const getCaseFileByUlid = async (
  ulid: string,
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult | undefined> => {
  const caseFileEntity = await repositoryProvider.CaseFileModel.get({
    PK: `CASE#${caseUlid}#`,
    SK: `FILE#${ulid}#`,
  });

  if (!caseFileEntity) {
    return caseFileEntity;
  }
  return caseFileFromEntity(caseFileEntity);
};

export const getCaseFileByFileLocation = async (
  caseUlid: string,
  filePath: string,
  fileName: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult | undefined> => {
  const caseFileEntity = await repositoryProvider.CaseFileModel.get(
    {
      GSI2PK: `CASE#${caseUlid}#${filePath}${fileName}#`,
      GSI2SK: 'FILE#true#',
    },
    {
      index: 'GSI2',
    }
  );

  if (!caseFileEntity) {
    return caseFileEntity;
  }
  return caseFileFromEntity(caseFileEntity);
};

export const listCaseFilesByFilePath = async (
  caseUlid: string,
  filePath: string,
  limit: number,
  repositoryProvider: ModelRepositoryProvider,
  nextToken?: object
): Promise<Paged<DeaCaseFileResult>> => {
  const caseFileEntities = await repositoryProvider.CaseFileModel.find(
    {
      GSI1PK: `CASE#${caseUlid}#${filePath}#`,
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const caseFiles: Paged<DeaCaseFileResult> = caseFileEntities
    .map((entity) => caseFileFromEntity(entity))
    .filter(isDefined);
  caseFiles.count = caseFileEntities.length;
  caseFiles.next = caseFileEntities.next;
  return caseFiles;
};

export const listCasesByFile = async (
  ulid: string,
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaCaseFileResult>> => {
  const caseFileEntities = await repositoryProvider.CaseFileModel.find(
    {
      GSI3PK: `FILE#${ulid}#`,
      GSI3SK: {
        begins_with: 'CASE#',
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI3',
    }
  );

  const caseFiles: Paged<DeaCaseFileResult> = caseFileEntities
    .map((entity) => caseFileFromEntity(entity))
    .filter(isDefined);
  caseFiles.count = caseFileEntities.count;
  caseFiles.next = caseFileEntities.next;

  return caseFiles;
};

export const deleteCaseFileAssociation = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  const transaction = {};
  await repositoryProvider.CaseFileModel.remove(
    {
      PK: `CASE#${deaCaseFile.caseUlid}#`,
      SK: `FILE#${deaCaseFile.ulid}#`,
    },
    { transaction }
  );
  if (deaCaseFile.isFile) {
    await repositoryProvider.CaseModel.update(
      {
        PK: `CASE#${deaCaseFile.caseUlid}#`,
        SK: 'CASE#',
      },
      {
        add: { objectCount: -1, totalSizeBytes: -deaCaseFile.fileSizeBytes },
        transaction,
      }
    );
    await repositoryProvider.DataVaultFileModel.update(
      {
        PK: `DATAVAULT#${deaCaseFile.dataVaultUlid}#`,
        SK: `FILE#${deaCaseFile.ulid}#`,
      },
      {
        add: { caseCount: -1 },
        transaction,
      }
    );
  }

  await repositoryProvider.table.transact('write', transaction);
  // Remove case file paths if empty.
  await removeCaseFilePaths(deaCaseFile.caseUlid, deaCaseFile.filePath, repositoryProvider);
};

const removeCaseFilePaths = async (
  caseUlid: string,
  filePath: string,
  repositoryProvider: ModelRepositoryProvider
) => {
  const noTrailingSlashPath = filePath.substring(0, filePath.length - 1);
  if (noTrailingSlashPath.length > 0) {
    const caseFiles = await listCaseFilesByFilePath(caseUlid, filePath, 1, repositoryProvider);
    if (caseFiles.length > 0) {
      // file path non empty.
      logger.info('file path non empty', { caseUlid, filePath, count: caseFiles.length });
      return;
    }

    // Get's the case file entry by location.
    const caseFileEntity = await repositoryProvider.CaseFileModel.get(
      {
        GSI2PK: `CASE#${caseUlid}#${noTrailingSlashPath}#`,
      },
      {
        index: 'GSI2',
      }
    );

    if (!caseFileEntity) {
      // file path has been deleted.
      logger.info('file path has been deleted', { caseUlid, noTrailingSlashPath });
      return;
    }
    await repositoryProvider.CaseFileModel.remove({
      PK: `CASE#${caseFileEntity.caseUlid}#`,
      SK: `FILE#${caseFileEntity.ulid}#`,
    });
    await removeCaseFilePaths(caseUlid, caseFileEntity.filePath, repositoryProvider);
  }
};
