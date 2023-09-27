/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { DeaDataVaultExecution } from '../models/data-vault-execution';
import { dataVaultExecutionFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { ModelRepositoryProvider } from './schema/entities';

export const createDataVaultExecution = async (
  deaDataVaultExecution: DeaDataVaultExecution,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultExecution> => {
  const dataVaultExecutionEntity = await repositoryProvider.DataVaultExecutionModel.create({
    ...deaDataVaultExecution,
  });

  return dataVaultExecutionFromEntity(dataVaultExecutionEntity);
};

export const listDataVaultExecutions = async (
  repositoryProvider: ModelRepositoryProvider,
  taskId: string,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVaultExecution>> => {
  const executionEntities = await repositoryProvider.DataVaultExecutionModel.find(
    {
      GSI1PK: `TASK#${taskId}#`,
      GSI1SK: {
        begins_with: `TASK#EXECUTION#`,
      },
    },
    {
      next: nextToken,
      limit,
      index: 'GSI1',
    }
  );

  const executions: Paged<DeaDataVaultExecution> = executionEntities
    .map((entity) => dataVaultExecutionFromEntity(entity))
    .filter(isDefined);
  executions.count = executionEntities.count;
  executions.next = executionEntities.next;

  return executions;
};
