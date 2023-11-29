/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateTaskCommand,
  OverwriteMode,
  PreserveDeletedFiles,
  ReportLevel,
  ReportOutputType,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import {
  createDatasyncTask,
  createS3Location,
  deleteDatasyncLocation,
  deleteDatasyncTask,
  describeTask,
  getDataSyncTask,
  listDatasyncTasks,
} from '../../app/services/data-sync-service';
import { createDataVault } from '../../app/services/data-vault-service';
import { retry } from '../../app/services/service-helpers';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { defaultProvider, ModelRepositoryProvider } from '../../persistence/schema/entities';
import { DataSyncProvider, defaultDataSyncProvider } from '../../storage/dataSync';

const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;
const repositoryProvider: ModelRepositoryProvider = defaultProvider;

describe('data-sync-service integration tests', () => {
  const taskArnsToCleanUp: string[] = [];
  const locationsToCleanUp: string[] = [];

  let sourceLocationArn: string;
  let destinationLocationArn: string;
  let dataVaultUlid: string;

  beforeAll(async () => {
    dataVaultUlid = (
      await createDataVault(
        {
          name: `vault for data sync integ test ${new Date().getTime()}`,
        },
        repositoryProvider
      )
    ).ulid;
    sourceLocationArn = await createS3LocationSuccess(`/DATAVAULT${dataVaultUlid}/locationtest1`);
    destinationLocationArn = await createS3LocationSuccess(`DATAVAULT${dataVaultUlid}/locationtest2`);
  }, 480000);

  afterAll(async () => {
    // Have to clean up tasks before we can cleanup locations
    const taskPromises: Promise<string | undefined>[] = taskArnsToCleanUp.map((taskArn) => {
      try {
        return retry(async () => deleteDatasyncTask(taskArn, dataSyncProvider), 5, 1000);
      } catch (e) {
        console.log(`Failed to clean up task ${taskArn}`);
        return Promise.resolve(``);
      }
    });
    await Promise.all(taskPromises);

    const locationPromises: Promise<string | undefined>[] = locationsToCleanUp.map((locationArn) => {
      try {
        return deleteDatasyncLocation(locationArn, dataSyncProvider);
      } catch (e) {
        console.log(`Failed to clean up location ${locationArn}`);
        return Promise.resolve(``);
      }
    });
    await Promise.all(locationPromises);
  }, 480000);

  it('should get the task successfully', async () => {
    const taskArn = await createDatasyncTaskSuccess('taskname', sourceLocationArn, destinationLocationArn);

    const task = await getDataSyncTask(taskArn, dataSyncProvider, repositoryProvider);
    expect(task.taskArn).toBeDefined();
  }, 480000);

  it('should successfully fetch a list of datasync tasks', async () => {
    await createDatasyncTaskSuccess('list task name 1', sourceLocationArn, destinationLocationArn);
    await createDatasyncTaskSuccess('list task name 2', sourceLocationArn, destinationLocationArn);

    const dataSyncTasks = await listDatasyncTasks(dataSyncProvider);

    // Create an array to store DeaDataSyncTask objects
    const deaDataSyncTasks: DeaDataSyncTask[] = [];

    // Loop through the tasks and fetch details for each
    for (const task of dataSyncTasks) {
      if (task.TaskArn) {
        const deaDataSyncTask = await describeTask(task.TaskArn, dataSyncProvider);
        deaDataSyncTasks.push(deaDataSyncTask);
      }
    }

    expect(deaDataSyncTasks.length).toBeGreaterThan(0);
  }, 480000);

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
  }, 480000);

  it('should fail to get the task if the destination location is not properly set', async () => {
    // Swap some settings to create a destination location with different settings.
    const anotherDataSyncProvider: DataSyncProvider = {
      ...dataSyncProvider,
      //dataSyncRoleArn: dataSyncProvider.dataSyncReportsRoleArn,
      datasetsBucketArn: dataSyncProvider.dataSyncReportsBucketArn,
    };
    const source = await createS3LocationSuccess(
      `/DATAVAULT${dataVaultUlid}/locationtest1`,
      dataSyncProvider
    );
    const destination = await createS3LocationSuccess(
      `DATAVAULT${dataVaultUlid}/locationtest2`,
      anotherDataSyncProvider
    );
    const taskArn = await createDatasyncTaskSuccess('taskname', source, destination);

    await expect(getDataSyncTask(taskArn, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'Destination Location is not properly set'
    );
  }, 480000);

  it('should fail to get the task if the task is not properly set', async () => {
    // Swap some settings to create a task with different settings.
    const anotherDataSyncProvider: DataSyncProvider = {
      ...dataSyncProvider,
      dataSyncReportsBucketArn: dataSyncProvider.datasetsBucketArn,
      dataSyncReportsRoleArn: dataSyncProvider.dataSyncRoleArn,
    };
    const taskArn = await createDatasyncTaskSuccess(
      'taskname',
      sourceLocationArn,
      destinationLocationArn,
      anotherDataSyncProvider
    );

    await expect(getDataSyncTask(taskArn, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );
  }, 480000);

  it('should fail to get the task if the task if task options are incorrect', async () => {
    // CASE: Don't set Task Options
    const noOptionsTask = await createTaskWithInput(`no options task ${new Date().getTime()}`, {
      sourceLocationArn,
      destinationLocationArn,
      leaveOptionsEmpty: true,
    });
    await expect(getDataSyncTask(noOptionsTask, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );

    // CASE: Overwrite files is checked
    const overwriteAllowedTask = await createTaskWithInput(`overwrite allowed task ${new Date().getTime()}`, {
      sourceLocationArn,
      destinationLocationArn,
      overwriteMode: OverwriteMode.ALWAYS,
    });
    await expect(getDataSyncTask(overwriteAllowedTask, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );

    // CASE: Verify files is
    const wrongVerifySettingTask = await createTaskWithInput(
      `dont verify files task ${new Date().getTime()}`,
      { sourceLocationArn: sourceLocationArn, destinationLocationArn, verifyMode: VerifyMode.NONE }
    );
    await expect(
      getDataSyncTask(wrongVerifySettingTask, dataSyncProvider, repositoryProvider)
    ).rejects.toThrow('DataSync Task is not properly set');

    // CASE: Preserve deleted files is not selected
    const deleteDeletedFilesTask = await createTaskWithInput(
      `dont preserve deleted files task ${new Date().getTime()}`,
      {
        sourceLocationArn,
        destinationLocationArn,
        preserveDeletedFiles: PreserveDeletedFiles.REMOVE,
      }
    );
    await expect(
      getDataSyncTask(deleteDeletedFilesTask, dataSyncProvider, repositoryProvider)
    ).rejects.toThrow('DataSync Task is not properly set');
  }, 480000);

  it('should fail to get the task if the task if task report settings are incorrect', async () => {
    // CASE: Don't set Task Report
    const noTaskReportSettings = await createTaskWithInput(
      `dont set task report settings ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn, leaveTaskReportEmpty: true }
    );
    await expect(getDataSyncTask(noTaskReportSettings, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );

    // CASE: Report type is not STANDARD
    const incorrectReportType = await createTaskWithInput(`incorrect report type ${new Date().getTime()}`, {
      sourceLocationArn,
      destinationLocationArn,
      reportOutputType: ReportOutputType.SUMMARY_ONLY,
    });
    await expect(getDataSyncTask(incorrectReportType, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );

    // CASE: Report Level is not SUCCESSES and errors
    const incorrectReportLevel = await createTaskWithInput(`incorrect report level ${new Date().getTime()}`, {
      sourceLocationArn,
      destinationLocationArn,
      reportLevel: ReportLevel.ERRORS_ONLY,
    });
    await expect(getDataSyncTask(incorrectReportLevel, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'DataSync Task is not properly set'
    );

    // CASE: The report does not go to the correct bucket
    await expect(
      createTaskWithInput(`incorrect report bucket ${new Date().getTime()}`, {
        sourceLocationArn,
        destinationLocationArn,
        taskReportS3Bucket: dataSyncProvider.datasetsBucketArn,
      })
    ).rejects.toThrow('DataSync bucket access test failed: could not perform s3:PutObject in bucket');

    // CASE: The IAM Role is not the correct for the task report bucket
    const iamRole = getRequiredEnv(
      'DELETE_CASE_FILE_ROLE',
      'DELETE_CASE_FILE_ROLE is not set in your lambda!'
    );
    await expect(
      createTaskWithInput(`incorrect report iam role ${new Date().getTime()}`, {
        sourceLocationArn,
        destinationLocationArn,
        bucketAccessRoleArn: iamRole,
      })
    ).rejects.toThrow(`IAM Role is malformed!`);
  }, 480000);

  it('should fail to get the task if the destination is incorrect', async () => {
    // CASE: Destination Location is not a data vault
    const notADVLoc = await createS3LocationSuccess(``, dataSyncProvider);
    const nonDataVaultLocation = await createTaskWithInput(
      `destination is not a data vault ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: notADVLoc }
    );
    await expect(getDataSyncTask(nonDataVaultLocation, dataSyncProvider, repositoryProvider)).rejects.toThrow(
      'Destination Location is not a data vault'
    );

    // CASE: Data Vault does not exist
    const nonExistentDataVaultUlid = 'ABCDEFGH3JK1MN2PQRST4VWXYZ';
    const dvDoesNotExist = await createS3LocationSuccess(
      `/DATAVAULT${nonExistentDataVaultUlid}/locationtest2`,
      dataSyncProvider
    );
    const nonDataVaultLocationTask = await createTaskWithInput(
      `data vault does not exist ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: dvDoesNotExist }
    );
    await expect(
      getDataSyncTask(nonDataVaultLocationTask, dataSyncProvider, repositoryProvider)
    ).rejects.toThrow('Data Vault does not exist');
  }, 480000);

  it('should pass on data vault locations with and without a following file path', async () => {
    // CASE: Root folder of data vault
    const rootLoc = await createS3LocationSuccess(`/DATAVAULT${dataVaultUlid}`, dataSyncProvider);
    const rootFolderDataVaultLocation = await createTaskWithInput(
      `root folder of data vault ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: rootLoc }
    );
    const task1 = await getDataSyncTask(rootFolderDataVaultLocation, dataSyncProvider, repositoryProvider);
    expect(task1.taskArn).toBeDefined();
    expect(task1.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/`);

    // CASE: root folder with trailing slash
    const rootFolderTrailingLoc = await createS3LocationSuccess(
      `/DATAVAULT${dataVaultUlid}/`,
      dataSyncProvider
    );
    const rootFolderDataVaultLocationTrailingSlash = await createTaskWithInput(
      `root folder of data vault trailing slash ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: rootFolderTrailingLoc }
    );
    const task2 = await getDataSyncTask(
      rootFolderDataVaultLocationTrailingSlash,
      dataSyncProvider,
      repositoryProvider
    );
    expect(task2.taskArn).toBeDefined();
    expect(task2.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/`);

    // CASE: One level folder in data vault
    const level1Loc = await createS3LocationSuccess(`/DATAVAULT${dataVaultUlid}/Evidence`, dataSyncProvider);
    const level1FolderDataVaultLocation = await createTaskWithInput(
      `level1 folder of data vault ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: level1Loc }
    );
    const task3 = await getDataSyncTask(level1FolderDataVaultLocation, dataSyncProvider, repositoryProvider);
    expect(task3.taskArn).toBeDefined();
    expect(task3.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/Evidence/`);

    // CASE: One level folder in data vault trailing slash
    const level1TrailingLoc = await createS3LocationSuccess(
      `/DATAVAULT${dataVaultUlid}/Evidence/`,
      dataSyncProvider
    );
    const level1FolderDataVaultLocationTrailingSlash = await createTaskWithInput(
      `level1 folder of data vault trailing slash ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: level1TrailingLoc }
    );
    const task4 = await getDataSyncTask(
      level1FolderDataVaultLocationTrailingSlash,
      dataSyncProvider,
      repositoryProvider
    );
    expect(task4.taskArn).toBeDefined();
    expect(task4.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/Evidence/`);

    // CASE: Two level folder in data vault
    const level2Loc = await createS3LocationSuccess(
      `/DATAVAULT${dataVaultUlid}/Evidence/BodyCam`,
      dataSyncProvider
    );
    const level2FolderDataVaultLocation = await createTaskWithInput(
      `level2 folder of data vault trailing slash ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: level2Loc }
    );
    const task5 = await getDataSyncTask(level2FolderDataVaultLocation, dataSyncProvider, repositoryProvider);
    expect(task5.taskArn).toBeDefined();
    expect(task5.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/Evidence/BodyCam/`);

    // CASE: Three Level folder in datavault
    const level3loc = await createS3LocationSuccess(
      `/DATAVAULT${dataVaultUlid}/Evidence/BodyCam/Footage/`,
      dataSyncProvider
    );
    const level3FolderDataVaultLocation = await createTaskWithInput(
      `level3 folder of data vault trailing slash ${new Date().getTime()}`,
      { sourceLocationArn, destinationLocationArn: level3loc }
    );
    const task6 = await getDataSyncTask(level3FolderDataVaultLocation, dataSyncProvider, repositoryProvider);
    expect(task6.taskArn).toBeDefined();
    expect(task6.destinationFolder).toBe(`DATAVAULT${dataVaultUlid}/Evidence/BodyCam/Footage/`);
  }, 480000);

  type TaskInputMask = {
    sourceLocationArn: string;
    destinationLocationArn: string;
    verifyMode?: VerifyMode;
    overwriteMode?: OverwriteMode;
    preserveDeletedFiles?: PreserveDeletedFiles;
    taskReportS3Bucket?: string;
    bucketAccessRoleArn?: string;
    reportOutputType?: ReportOutputType;
    reportLevel?: ReportLevel;
    leaveOptionsEmpty?: boolean;
    leaveTaskReportEmpty?: boolean;
  };

  async function createTaskWithInput(name: string, input: TaskInputMask): Promise<string> {
    const maybeTaskArn = await retry(
      async () => {
        const response = await dataSyncProvider.dataSyncClient.send(
          new CreateTaskCommand({
            SourceLocationArn: input.sourceLocationArn,
            DestinationLocationArn: input.destinationLocationArn,
            Name: name,
            Options: input.leaveOptionsEmpty
              ? undefined
              : {
                  VerifyMode: input.verifyMode ?? VerifyMode.ONLY_FILES_TRANSFERRED,
                  OverwriteMode: input.overwriteMode ?? OverwriteMode.NEVER,
                  PreserveDeletedFiles: input.preserveDeletedFiles ?? PreserveDeletedFiles.PRESERVE,
                },
            TaskReportConfig: input.leaveTaskReportEmpty
              ? undefined
              : {
                  Destination: {
                    S3: {
                      S3BucketArn: input.taskReportS3Bucket ?? dataSyncProvider.dataSyncReportsBucketArn,
                      BucketAccessRoleArn:
                        input.bucketAccessRoleArn ?? dataSyncProvider.dataSyncReportsRoleArn,
                    },
                  },
                  OutputType: input.reportOutputType ?? ReportOutputType.STANDARD,
                  ReportLevel:
                    input.reportOutputType === ReportOutputType.SUMMARY_ONLY
                      ? undefined
                      : input.reportLevel ?? ReportLevel.SUCCESSES_AND_ERRORS,
                },
          })
        );

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!response.TaskArn) {
          throw new Error('Failed creating task');
        }
        taskArnsToCleanUp.push(response.TaskArn);
        return response.TaskArn;
      },
      5,
      10000
    );

    if (!maybeTaskArn) {
      throw new Error('Ran out of retries for creating task');
    }

    return maybeTaskArn;
  }

  async function createS3LocationSuccess(
    destinationFolder: string,
    provider = dataSyncProvider
  ): Promise<string> {
    const locationArn = await createS3Location(destinationFolder, provider);
    expect(locationArn).toBeTruthy();
    locationsToCleanUp.push(locationArn);
    return locationArn;
  }

  async function createDatasyncTaskSuccess(
    name: string,
    sourceLocation: string,
    destinationLocation: string,
    provider = dataSyncProvider
  ): Promise<string> {
    const taskArn = await createDatasyncTask(name, sourceLocation, destinationLocation, provider);
    expect(taskArn).toBeTruthy();
    taskArnsToCleanUp.push(taskArn);
    return taskArn;
  }
});
