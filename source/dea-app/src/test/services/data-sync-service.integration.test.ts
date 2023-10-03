/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  createDatasyncTask,
  createS3Location,
  deleteDatasyncLocation,
  deleteDatasyncTask,
  desrcibeTask,
  listDatasyncTasks,
  startDatasyncTaskExecution,
} from '../../app/services/data-sync-service';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { DataSyncProvider, defaultDataSyncProvider } from '../../storage/dataSync';

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

const dataVaultUlid = 'abc';

describe('data-sync-service integration tests', () => {
  let locationArn1 = '';
  let locationArn2 = '';
  let taskArn = '';

  afterAll(async () => {
    await deleteDatasyncTask(taskArn, dataSyncProvider);
    await deleteDatasyncLocation(locationArn1, dataSyncProvider);
    await deleteDatasyncLocation(locationArn2, dataSyncProvider);
  });

  it('should create datavault s3 task and run it', async () => {
    locationArn1 = await createS3Location(`/DATAVAULT${dataVaultUlid}/locationtest1`, dataSyncProvider);
    expect(locationArn1).toBeTruthy();
    locationArn2 = await createS3Location(`DATAVAULT${dataVaultUlid}/locationtest2`, dataSyncProvider);
    expect(locationArn2).toBeTruthy();
    taskArn = await createDatasyncTask('taskname', locationArn1, locationArn2, dataSyncProvider);
    expect(taskArn).toBeTruthy();
    const executionArn = await startDatasyncTaskExecution(taskArn, dataSyncProvider);
    expect(executionArn).toBeTruthy();
  }, 40000);

  it('should successfully fetch a list of datasync tasks', async () => {
    const dataSyncTasks = await listDatasyncTasks(dataSyncProvider);

    // Create an array to store DeaDataSyncTask objects
    const deaDataSyncTasks: DeaDataSyncTask[] = [];

    // Loop through the tasks and fetch details for each
    for (const task of dataSyncTasks) {
      if (task.TaskArn) {
        const deaDataSyncTask = await desrcibeTask(task.TaskArn, dataSyncProvider);
        deaDataSyncTasks.push(deaDataSyncTask);
      }
    }

    expect(deaDataSyncTasks.length).toBeGreaterThan(0);
  }, 40000);

  it('should successfully delete location and tasks', async () => {
    const deleteLocationTest = await createS3Location(
      `/DATAVAULT${dataVaultUlid}/locationtest1`,
      dataSyncProvider
    );
    const deleteLocationTest2 = await createS3Location(
      `DATAVAULT${dataVaultUlid}/locationtest2`,
      dataSyncProvider
    );
    const deleteTaskArn = await createDatasyncTask(
      'taskname',
      deleteLocationTest,
      deleteLocationTest2,
      dataSyncProvider
    );

    expect(await deleteDatasyncTask(deleteTaskArn, dataSyncProvider)).toEqual(deleteTaskArn);
    expect(await deleteDatasyncLocation(deleteLocationTest, dataSyncProvider)).toEqual(deleteLocationTest);
    expect(await deleteDatasyncLocation(deleteLocationTest2, dataSyncProvider)).toEqual(deleteLocationTest2);
  }, 40000);
});
