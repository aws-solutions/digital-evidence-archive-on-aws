/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { OneTableError, Paged } from 'dynamodb-onetable';
import { DeaDataVault, DeaDataVaultInput } from '../../models/data-vault';
import { DeaDataVaultExecution } from '../../models/data-vault-execution';
import { DeaDataVaultTask, DeaDataVaultTaskInput } from '../../models/data-vault-task';
import * as DataVaultPersistence from '../../persistence/data-vault';
import * as DataVaultExecutionPersistence from '../../persistence/data-vault-execution';
import * as DataVaultTaskPersistence from '../../persistence/data-vault-task';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';

export const createDataVault = async (
  deaDataVault: DeaDataVaultInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVault> => {
  try {
    return await DataVaultPersistence.createDataVault(deaDataVault, repositoryProvider);
  } catch (error) {
    // Check if OneTableError happened because the data vault name is already in use.
    if ('code' in error) {
      const oneTableError: OneTableError = error;
      const conditionalcheckfailed = oneTableError.context?.err?.CancellationReasons.find(
        (reason: { Code: string }) => reason.Code === 'ConditionalCheckFailed'
      );
      if (oneTableError.code === 'TransactionCanceledException' && conditionalcheckfailed) {
        throw new ValidationError(`Data Vault name is already in use`);
      }
    }
    throw error;
  }
};

export const listDataVaults = async (
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVault>> => {
  return DataVaultPersistence.listDataVaults(repositoryProvider, nextToken, limit);
};

export const createDataVaultTask = async (
  deaDataVaultTask: DeaDataVaultTaskInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultTask> => {
  try {
    return await DataVaultTaskPersistence.createDataVaultTask(deaDataVaultTask, repositoryProvider);
  } catch (error) {
    // Check if OneTableError happened because the task name is already in use.
    if ('code' in error) {
      const oneTableError: OneTableError = error;
      const conditionalcheckfailed = oneTableError.context?.err?.CancellationReasons.find(
        (reason: { Code: string }) => reason.Code === 'ConditionalCheckFailed'
      );
      if (oneTableError.code === 'TransactionCanceledException' && conditionalcheckfailed) {
        throw new ValidationError(`Data Vault task name is already in use`);
      }
    }
    throw error;
  }
};

export const listDataVaultTasks = async (
  repositoryProvider: ModelRepositoryProvider,
  dataVaultUlid: string,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVaultTask>> => {
  return DataVaultTaskPersistence.listDataVaultTasks(repositoryProvider, dataVaultUlid, nextToken, limit);
};

export const createDataVaultExecution = async (
  deaDataVaultExecution: DeaDataVaultExecution,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaDataVaultExecution> => {
  return await DataVaultExecutionPersistence.createDataVaultExecution(
    deaDataVaultExecution,
    repositoryProvider
  );
};

export const listDataVaultExecutions = async (
  repositoryProvider: ModelRepositoryProvider,
  taskId: string,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaDataVaultExecution>> => {
  return DataVaultExecutionPersistence.listDataVaultExecutions(repositoryProvider, taskId, nextToken, limit);
};
