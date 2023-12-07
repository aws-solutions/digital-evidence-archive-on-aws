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
  deaDataVaultFiles: DataVaultFileDTO[],
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile[]> => {
  const dataVaultFiles = [];
  const batchSize = 25;

  for (let i = 0; i < deaDataVaultFiles.length; i += batchSize) {
    const currentBatch = deaDataVaultFiles.slice(i, i + batchSize);

    const batch = {};
    for (const deaDataVaultFile of currentBatch) {
      const dataVaultFileEntity = await repositoryProvider.DataVaultFileModel.create(
        { ...deaDataVaultFile },
        { batch, exists: null }
      );
      dataVaultFiles.push(dataVaultFileFromEntity(dataVaultFileEntity));
    }

    await repositoryProvider.table.batchWrite(batch);
  }
  return dataVaultFiles;
};

export const getDataVaultFileByUlid = async (
  ulid: string,
  dataVaultUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultFile | undefined> => {
  const dataVaultFileEntity = await repositoryProvider.DataVaultFileModel.get(
    {
      GSI1PK: `DATAVAULT#${dataVaultUlid}#`,
      GSI1SK: `FILE#${ulid}#`,
    },
    {
      index: 'GSI1',
    }
  );

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
      PK: `DATAVAULT#${dataVaultUlid}#${filePath}#`,
    },
    {
      next: nextToken,
      limit,
    }
  );

  const dataVaultFiles: Paged<DeaDataVaultFile> = dataVaultFileEntities
    .map((entity) => dataVaultFileFromEntity(entity))
    .filter(isDefined);
  dataVaultFiles.count = dataVaultFileEntities.length;
  dataVaultFiles.next = dataVaultFileEntities.next;
  return dataVaultFiles;
};
