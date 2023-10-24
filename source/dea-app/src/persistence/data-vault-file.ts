/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DataVaultFileDTO, DeaDataVaultFile } from '../models/data-vault-file';
import { dataVaultFileFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider } from './schema/entities';

export const createDataVaultFile = async (
  deaDataVaultFile: DataVaultFileDTO,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile> => {
  const dataVaultFileEntity = await repositoryProvider.DataVaultFileModel.create({
    ...deaDataVaultFile,
  });

  return dataVaultFileFromEntity(dataVaultFileEntity);
};

export const getDataVaultFileByUlid = async (
  ulid: string,
  dataVaultUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile | undefined> => {
  const dataVaultFileEntity = await repositoryProvider.DataVaultFileModel.get({
    PK: `DATAVAULT#${dataVaultUlid}#`,
    SK: `FILE#${ulid}#`,
  });

  if (!dataVaultFileEntity) {
    return dataVaultFileEntity;
  }
  return dataVaultFileFromEntity(dataVaultFileEntity);
};

export const listDataVaultFilesByFilePath = async (
  dataVaultUlid: string,
  filePath: string,
  limit = 30,
  repositoryProvider: ModelRepositoryProvider,
  nextToken?: object
): Promise<Paged<DeaDataVaultFile>> => {
  const dataVaultFileEntities = await repositoryProvider.DataVaultFileModel.find(
    {
      GSI1PK: `DATAVAULT#${dataVaultUlid}#${filePath}#`,
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const dataVaultFiles: Paged<DeaDataVaultFile> = dataVaultFileEntities
    .map((entity) => dataVaultFileFromEntity(entity))
    .filter(isDefined);
  dataVaultFiles.count = dataVaultFileEntities.length;
  dataVaultFiles.next = dataVaultFileEntities.next;
  return dataVaultFiles;
};
