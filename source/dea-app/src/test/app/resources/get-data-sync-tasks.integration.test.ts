/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getDataSyncTasks } from '../../../app/resources/get-data-sync-tasks';
import { retry } from '../../../app/services/service-helpers';
import { DeaDataSyncTask } from '../../../models/data-sync-task';
import { dataSyncTaskSchema } from '../../../models/validation/data-vault';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callGetDataSyncTasks } from './data-sync-tasks-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;

describe('get data sync tasks', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataSyncListTasksTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should return a list of data sync tasks', async () => {
    const response = await retry(async () => {
      const response = await getDataSyncTasks(getDummyEvent(), dummyContext, repositoryProvider);
      return response;
    });
    if (!response) {
      throw new Error('No response returned');
    }

    const tasks: DeaDataSyncTask[] = JSON.parse(response.body).dataSyncTasks;

    for (const task of tasks) {
      Joi.assert(task, dataSyncTaskSchema);
    }

    expect(response.statusCode).toEqual(200);
    expect(tasks).toBeDefined();
  }, 40000);

  it('should paginate a list of data sync tasks', async () => {
    const limit = 1;
    let next: string | undefined = undefined;
    const responseWithPagination = await callGetDataSyncTasks(repositoryProvider, limit, next);
    if (!responseWithPagination) {
      throw new Error('No response returned');
    }
    expect(responseWithPagination.statusCode).toEqual(200);

    const responseBodyWithPagination = JSON.parse(responseWithPagination.body);
    expect(responseBodyWithPagination.dataSyncTasks.length).toEqual(limit);
    expect(responseBodyWithPagination.next).toBeDefined();

    // Get next page
    next = responseBodyWithPagination.next;
    const responseNextPage = await callGetDataSyncTasks(repositoryProvider, limit, next);
    if (!responseNextPage) {
      throw new Error('No response returned');
    }
    expect(responseNextPage.statusCode).toEqual(200);

    const responseBody = JSON.parse(responseNextPage.body);
    expect(responseBody.dataSyncTasks.length).toEqual(limit);
  }, 40000);
});
