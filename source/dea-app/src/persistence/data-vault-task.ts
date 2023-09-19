/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultTask } from '../models/data-vault-task';
import { dataVaultTaskFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider } from './schema/entities';

export const createDataVaultTask = async (
  deaDataVaultTask: DeaDataVaultTask,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultTask> => {
  const dataVaultTaskEntity = await repositoryProvider.DataVaultTaskModel.create({
    ...deaDataVaultTask,
  });
  return dataVaultTaskFromEntity(dataVaultTaskEntity);
};

export const listDataVaultTasks = async (
  repositoryProvider: ModelRepositoryProvider,
  dataVaultUlid: string,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVaultTask>> => {
  const taskEntities = await repositoryProvider.DataVaultTaskModel.find(
    {
      GSI1PK: `DATAVAULT#${dataVaultUlid}#`,
      GSI1SK: {
        begins_with: `DATAVAULT#TASK#`,
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const tasks: Paged<DeaDataVaultTask> = taskEntities
    .map((entity) => dataVaultTaskFromEntity(entity))
    .filter(isDefined);
  tasks.count = taskEntities.count;
  tasks.next = taskEntities.next;

  return tasks;
};
