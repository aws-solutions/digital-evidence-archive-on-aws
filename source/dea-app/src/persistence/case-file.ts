/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaCaseFile } from '../models/case-file';
import { CaseFileStatus } from '../models/case-file-status';
import { caseFileFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider } from './schema/entities';

const SECONDS_IN_AN_HOUR = 60 * 60;

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
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
): Promise<DeaCaseFile> => {
  const newEntity = await repositoryProvider.CaseFileModel.update({
    ...deaCaseFile,
    status: CaseFileStatus.ACTIVE,
    ttl: null,
  });
  return caseFileFromEntity(newEntity);
};

export const getCaseFileByUlid = async (
  ulid: string,
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile | undefined> => {
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
): Promise<DeaCaseFile | undefined> => {
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
): Promise<Paged<DeaCaseFile>> => {
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

  const caseFiles: Paged<DeaCaseFile> = caseFileEntities
    .map((entity) => caseFileFromEntity(entity))
    .filter(isDefined);
  caseFiles.count = caseFileEntities.length;
  caseFiles.next = caseFileEntities.next;
  return caseFiles;
};
