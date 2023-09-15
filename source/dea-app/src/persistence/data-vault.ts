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
  const transaction = {};
  const dataVaultEntity = await repositoryProvider.DataVaultModel.create(
    {
      ...deaDataVault,
    },
    { transaction }
  );

  await repositoryProvider.table.transact('write', transaction);

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
