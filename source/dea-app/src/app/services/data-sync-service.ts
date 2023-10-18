/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  CreateTaskCommandInput,
  DeleteLocationCommand,
  DeleteTaskCommand,
  DescribeLocationS3Command,
  DescribeTaskCommand,
  ListTasksCommand,
  ReportDestination,
  ReportDestinationS3,
  ReportLevel,
  ReportOutputType,
  StartTaskExecutionCommand,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { DataSyncProvider } from '../../storage/dataSync';
import { retry } from './service-helpers';

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
  const response = await retry(async () => {
    const response = await dataSyncProvider.dataSyncClient.send(command);
    return response;
  });
  if (!response) {
    throw new Error('Location creation failed');
  }

  if (response.LocationArn) {
    return response.LocationArn;
  } else {
    throw new Error('Location creation failed');
  }
};

// function to create datasync task given name, and location arns. but turn off overwriting files option

export const createDatasyncTask = async (
  name: string,
  sourceLocationArn: string,
  destinationLocationArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const taskReportS3: ReportDestinationS3 = {
    S3BucketArn: dataSyncProvider.dataSyncReportsBucketArn,
    BucketAccessRoleArn: dataSyncProvider.dataSyncReportsRoleArn,
  };

  const taskReportDestination: ReportDestination = {
    S3: taskReportS3,
  };

  const taskSettings: CreateTaskCommandInput = {
    Name: name,
    SourceLocationArn: sourceLocationArn,
    DestinationLocationArn: destinationLocationArn,
    Options: {
      VerifyMode: VerifyMode.ONLY_FILES_TRANSFERRED,
      OverwriteMode: 'ALWAYS',
    },
    TaskReportConfig: {
      ReportLevel: ReportLevel.SUCCESSES_AND_ERRORS,
      OutputType: ReportOutputType.STANDARD,
      Destination: taskReportDestination,
    },
  };

  const command = new CreateTaskCommand(taskSettings);

  const response = await retry(async () => {
    const response = await dataSyncProvider.dataSyncClient.send(command);
    return response;
  });
  if (!response) {
    throw new Error('Task creation failed');
  }
  if (response.TaskArn) {
    return response.TaskArn;
  } else {
    throw new Error('Task creation failed');
  }
};

export const listDatasyncTasks = async (dataSyncProvider: DataSyncProvider) => {
  // List all tasks
  const listTasksCommand = new ListTasksCommand({});

  const listTasksResponse = await retry(async () => {
    const listTasksResponse = await dataSyncProvider.dataSyncClient.send(listTasksCommand);
    return listTasksResponse;
  });
  if (!listTasksResponse) {
    throw new Error('Task listing failed');
  }
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

  const describeTaskResponse = await retry(async () => {
    const describeTaskResponse = await dataSyncProvider.dataSyncClient.send(describeTaskCommand);
    return describeTaskResponse;
  });
  if (!describeTaskResponse) {
    throw new Error('Task description failed');
  }

  // Get Destination Location info for DATAVAULT ULID
  const destinationLocationArn = describeTaskResponse.DestinationLocationArn;
  const describeLocationCommand = new DescribeLocationS3Command({
    LocationArn: destinationLocationArn,
  });
  const describeLocationResponse = await retry(async () => {
    const describeLocationResponse = await dataSyncProvider.dataSyncClient.send(describeLocationCommand);
    return describeLocationResponse;
  });
  if (!describeLocationResponse) {
    throw new Error('Location description failed');
  }

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
    created: describeTaskResponse.CreationTime,
  };

  return DataSyncTask;
};

export const describeDatasyncLocation = async (locationArn: string, dataSyncProvider: DataSyncProvider) => {
  const command = new DescribeLocationS3Command({
    LocationArn: locationArn,
  });

  const response = await dataSyncProvider.dataSyncClient.send(command);
  return response;
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
    throw new Error('Task execution failed to start');
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
