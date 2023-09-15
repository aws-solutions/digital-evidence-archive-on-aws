/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  createDatasyncTask,
  createS3Location,
  deleteDatasyncLocation,
  deleteDatasyncTask,
} from '../../app/services/data-sync-service';
import { DataSyncProvider, defaultDataSyncProvider } from '../../storage/dataSync';

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

const dataVaultUlid = 'abc';

describe('data-sync-service integration tests', () => {
  let locationArn1 = '';
  let locationArn2 = '';
  let taskArn = '';

  it('should create datavault s3 locations for task generation', async () => {
    locationArn1 = await createS3Location(`/DATAVAULT${dataVaultUlid}/locationtest1`, dataSyncProvider);
    expect(locationArn1).toBeTruthy();
    locationArn2 = await createS3Location(`DATAVAULT${dataVaultUlid}/locationtest2`, dataSyncProvider);
    expect(locationArn2).toBeTruthy();
  }, 40000);

  it('should create datavault s3 task', async () => {
    taskArn = await createDatasyncTask('taskname', locationArn1, locationArn2, dataSyncProvider);
    expect(taskArn).toBeTruthy();
  }, 40000);

  it('should delete datavault s3 task and location arns', async () => {
    expect(await deleteDatasyncTask(taskArn, dataSyncProvider)).toEqual(taskArn);
    expect(await deleteDatasyncLocation(locationArn1, dataSyncProvider)).toEqual(locationArn1);
    expect(await deleteDatasyncLocation(locationArn2, dataSyncProvider)).toEqual(locationArn2);
  }, 40000);
});
