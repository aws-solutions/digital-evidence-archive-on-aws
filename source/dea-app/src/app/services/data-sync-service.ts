/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  DeleteLocationCommand,
  DeleteTaskCommand,
  DescribeLocationS3Command,
  DescribeTaskCommand,
  ListTasksCommand,
  StartTaskExecutionCommand,
} from '@aws-sdk/client-datasync';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { DataSyncProvider } from '../../storage/dataSync';
import { ValidationError } from '../exceptions/validation-exception';

export const createS3Location = async (
  destinationFolder: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const locationSettings = {
    Subdirectory: destinationFolder,
    S3BucketArn: dataSyncProvider.datasetsBucketArn,
    S3Config: {
      BucketAccessRoleArn: dataSyncProvider.dataSyncRoleArn,
    },
  };

  const command = new CreateLocationS3Command(locationSettings);
  const response = await dataSyncProvider.dataSyncClient.send(command);
  if (response.LocationArn) {
    return response.LocationArn;
  } else {
    throw new ValidationError('Location creation failed');
  }
};

// function to create datasync task given name, and location arns. but turn off overwriting files option

export const createDatasyncTask = async (
  name: string,
  sourceLocationArn: string,
  destinationLocationArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const taskSettings = {
    name,
    SourceLocationArn: sourceLocationArn,
    DestinationLocationArn: destinationLocationArn,
    options: {
      VerifyMode: 'ONLY_FILES_TRANSFERRED',
      OverwriteMode: 'NEVER',
    },
  };

  const command = new CreateTaskCommand(taskSettings);

  const response = await dataSyncProvider.dataSyncClient.send(command);
  if (response.TaskArn) {
    return response.TaskArn;
  } else {
    throw new ValidationError('Task creation failed');
  }
};

export const listDatasyncTasks = async (dataSyncProvider: DataSyncProvider) => {
  // List all tasks
  const listTasksCommand = new ListTasksCommand({});

  const listTasksResponse = await dataSyncProvider.dataSyncClient.send(listTasksCommand);
  const tasks = listTasksResponse.Tasks || [];
  return tasks;
};

export const desrcibeTask = async (
  taskArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<DeaDataSyncTask> => {
  const describeTaskCommand = new DescribeTaskCommand({
    TaskArn: taskArn,
  });

  const describeTaskResponse = await dataSyncProvider.dataSyncClient.send(describeTaskCommand);

  // Get Destination Location info for DATAVAULT ULID
  const destinationLocationArn = describeTaskResponse.DestinationLocationArn;
  const describeLocationCommand = new DescribeLocationS3Command({
    LocationArn: destinationLocationArn,
  });
  const describeLocationResponse = await dataSyncProvider.dataSyncClient.send(describeLocationCommand);

  const destinationUri = describeLocationResponse.LocationUri || '';
  const regex = /DATAVAULT([A-Z0-9]{26})/;
  const match = destinationUri.match(regex);

  let dataVaultUlid = '';
  if (match) {
    dataVaultUlid = match[1];
  }

  const DataSyncTask: DeaDataSyncTask = {
    taskArn: taskArn,
    taskId: taskArn.split('/')[1],
    sourceLocationArn: describeTaskResponse.SourceLocationArn,
    destinationLocationArn: describeTaskResponse.DestinationLocationArn,
    dataVaultUlid,
    status: describeTaskResponse.Status,
  };

  return DataSyncTask;
};

export const startDatasyncTaskExecution = async (
  taskArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const command = new StartTaskExecutionCommand({
    TaskArn: taskArn,
  });

  const response = await dataSyncProvider.dataSyncClient.send(command);
  if (response.TaskExecutionArn) {
    return response.TaskExecutionArn;
  } else {
    throw new ValidationError('Task execution failed to start');
  }
};

export const deleteDatasyncLocation = async (
  locationArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const command = new DeleteLocationCommand({
    LocationArn: locationArn,
  });

  await dataSyncProvider.dataSyncClient.send(command);

  return locationArn;
};

export const deleteDatasyncTask = async (
  taskArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const command = new DeleteTaskCommand({
    TaskArn: taskArn,
  });

  await dataSyncProvider.dataSyncClient.send(command);

  return taskArn;
};
