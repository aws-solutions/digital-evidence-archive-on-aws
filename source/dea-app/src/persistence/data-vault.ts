/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVault, DeaDataVaultInput } from '../models/data-vault';
import { dataVaultFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { DataVaultModelRepositoryProvider, ModelRepositoryProvider } from './schema/entities';

export const createDataVault = async (
  deaDataVault: DeaDataVaultInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVault> => {
  const dataVaultEntity = await repositoryProvider.DataVaultModel.create({
    ...deaDataVault,
  });

  return dataVaultFromEntity(dataVaultEntity);
};

export const listDataVaults = async (
  repositoryProvider: DataVaultModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVault>> => {
  const dataVaultEntities = await repositoryProvider.DataVaultModel.find(
    {
      GSI1PK: 'DATAVAULT#',
      GSI1SK: {
        begins_with: 'DATAVAULT#',
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const dataVaults: Paged<DeaDataVault> = dataVaultEntities
    .map((entity) => dataVaultFromEntity(entity))
    .filter(isDefined);
  dataVaults.count = dataVaultEntities.count;
  dataVaults.next = dataVaultEntities.next;

  return dataVaults;
};

export const getDataVault = async (
  ulid: string,
  repositoryProvider: DataVaultModelRepositoryProvider
): Promise<DeaDataVault | undefined> => {
  const dataVaultEntity = await repositoryProvider.DataVaultModel.get({
    PK: `DATAVAULT#${ulid}#`,
    SK: `DATAVAULT#`,
  });

  if (!dataVaultEntity) {
    return dataVaultEntity;
  }

  return dataVaultFromEntity(dataVaultEntity);
};

export const updateDataVault = async (
  deaDataVault: DeaDataVault,
  repositoryProvider: DataVaultModelRepositoryProvider
): Promise<DeaDataVault> => {
  const newCase = await repositoryProvider.DataVaultModel.update(
    {
      ...deaDataVault,
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );
  return dataVaultFromEntity(newCase);
};

export const updateDataVaultSize = async (
  ulid: string,
  fileSize: number,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVault> => {
  const dataVaultEntity = await repositoryProvider.DataVaultModel.update(
    {
      PK: `DATAVAULT#${ulid}#`,
      SK: `DATAVAULT#`,
    },
    {
      add: { objectCount: 1, totalSizeBytes: fileSize },
    }
  );

  return dataVaultFromEntity(dataVaultEntity);
};
