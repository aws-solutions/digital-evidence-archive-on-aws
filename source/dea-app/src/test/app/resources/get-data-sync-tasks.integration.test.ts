/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getDataSyncTasks } from '../../../app/resources/get-data-sync-tasks';
import { DeaDataSyncTask } from '../../../models/data-sync-task';
import { dataSyncTaskSchema } from '../../../models/validation/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('get data sync tasks', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataSyncListTasksTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should return a list of data sync tasks', async () => {
    const response = await getDataSyncTasks(getDummyEvent(), dummyContext, repositoryProvider);

    const tasks: DeaDataSyncTask[] = JSON.parse(response.body).dataSyncTasks;

    for (const task of tasks) {
      Joi.assert(task, dataSyncTaskSchema);
    }

    expect(response.statusCode).toEqual(200);
    expect(tasks).toBeDefined();
  });
});
