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
  DescribeTaskExecutionCommand,
  ListTaskExecutionsCommand,
  ListTaskExecutionsResponse,
  ListTasksCommand,
  ReportLevel,
  ReportOutputType,
  StartTaskExecutionCommand,
  TaskExecutionListEntry,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import Joi from 'joi';
import { logger } from '../../logger';
import { DeaDataSyncTask } from '../../models/data-sync-task';
import { DeaDataVaultTaskInput } from '../../models/data-vault-task';
import { DataSyncProvider } from '../../storage/dataSync';
import { ValidationError } from '../exceptions/validation-exception';
import { retry } from './service-helpers';

export const createS3Location = async (
  destinationFolder: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const locationSettings = {
    ...getDestinationLocationSettings(dataSyncProvider),
    S3BucketArn: dataSyncProvider.datasetsBucketArn,
    Subdirectory: destinationFolder,
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
  const taskSettings: CreateTaskCommandInput = {
    ...getDataSyncTaskSettings(dataSyncProvider),
    Name: name,
    SourceLocationArn: sourceLocationArn,
    DestinationLocationArn: destinationLocationArn,
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

  const dataVaultUlid = getDataVaultUlid(describeLocationResponse.LocationUri);

  //Get the last execution completed if the Task is Available and has a dataVaultUlid
  let lastExecutionCompleted = undefined;
  if (describeTaskResponse.Status === 'AVAILABLE' && dataVaultUlid) {
    let nextToken = undefined;
    do {
      const listTaskExecutionsResponse: ListTaskExecutionsResponse | undefined =
        await listDatasyncTaskExecutions(taskArn, nextToken, dataSyncProvider);
      if (listTaskExecutionsResponse?.TaskExecutions) {
        const taskExecutionCompletedArn = listTaskExecutionsResponse.TaskExecutions.slice()
          .reverse()
          .find((e: TaskExecutionListEntry) => e.Status === 'SUCCESS')?.TaskExecutionArn;
        if (taskExecutionCompletedArn) {
          const describeTaskExecutionResponse = await describeDatasyncTaskExecution(
            taskExecutionCompletedArn,
            dataSyncProvider
          );
          lastExecutionCompleted = describeTaskExecutionResponse?.StartTime;
          const totalDurationMilliseconds = describeTaskExecutionResponse?.Result?.TotalDuration ?? 0;
          lastExecutionCompleted?.setMilliseconds(
            lastExecutionCompleted?.getMilliseconds() + totalDurationMilliseconds
          );
        }
      }
      nextToken = listTaskExecutionsResponse?.NextToken;
    } while (nextToken);
  }

  const DataSyncTask: DeaDataSyncTask = {
    taskArn: taskArn,
    taskId: taskArn.split('/')[1],
    sourceLocationArn: describeTaskResponse.SourceLocationArn,
    destinationLocationArn: describeTaskResponse.DestinationLocationArn,
    dataVaultUlid,
    status: describeTaskResponse.Status,
    created: describeTaskResponse.CreationTime,
    lastExecutionCompleted,
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

export const listDatasyncTaskExecutions = async (
  taskArn: string,
  nextToken: string | undefined,
  dataSyncProvider: DataSyncProvider
) => {
  const command = new ListTaskExecutionsCommand({
    TaskArn: taskArn,
    NextToken: nextToken,
  });

  return await retry(async () => {
    return await dataSyncProvider.dataSyncClient.send(command);
  });
};

export const describeDatasyncTaskExecution = async (
  taskExecutionArn: string,
  dataSyncProvider: DataSyncProvider
) => {
  const command = new DescribeTaskExecutionCommand({
    TaskExecutionArn: taskExecutionArn,
  });

  return await retry(async () => {
    return await dataSyncProvider.dataSyncClient.send(command);
  });
};

export const getDataVaultUlid = (locationUri?: string) => {
  const destinationUri = locationUri || '';
  const regex = /DATAVAULT([A-Z0-9]{26})/;
  const match = destinationUri.match(regex);

  let dataVaultUlid = '';
  if (match) {
    dataVaultUlid = match[1];
  }
  return dataVaultUlid;
};

export const getDestinationFolder = (locationUri?: string) => {
  const destinationUri = locationUri || '';
  const regex = /(DATAVAULT[A-Z0-9]{26}\/.*)/;
  const match = destinationUri.match(regex);

  let destinationFolder = '';
  if (match) {
    destinationFolder = match[1];
  }
  return destinationFolder;
};

export const getDestinationLocationSettings = (dataSyncProvider: DataSyncProvider) => ({
  S3StorageClass: 'INTELLIGENT_TIERING',
  S3Config: {
    BucketAccessRoleArn: dataSyncProvider.dataSyncRoleArn,
  },
});

export const getDataSyncTaskSettings = (dataSyncProvider: DataSyncProvider) => ({
  Options: {
    VerifyMode: VerifyMode.ONLY_FILES_TRANSFERRED,
    OverwriteMode: 'ALWAYS',
  },
  TaskReportConfig: {
    ReportLevel: ReportLevel.SUCCESSES_AND_ERRORS,
    OutputType: ReportOutputType.STANDARD,
    Destination: {
      S3: {
        S3BucketArn: dataSyncProvider.dataSyncReportsBucketArn,
        BucketAccessRoleArn: dataSyncProvider.dataSyncReportsRoleArn,
      },
    },
  },
});

export const getDataSyncTask = async (
  taskArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<DeaDataVaultTaskInput> => {
  // Validate Task settings
  const datasyncTaskSettingSchema = Joi.compile(getDataSyncTaskSettings(dataSyncProvider));
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
  const dataSyncTaskValidationResult = datasyncTaskSettingSchema.validate(describeTaskResponse, {
    allowUnknown: true,
  });
  if (dataSyncTaskValidationResult.error) {
    logger.info('DataSync Task is not properly set', dataSyncTaskValidationResult.error.details);
    throw new ValidationError('DataSync Task is not properly set');
  }

  // Validate destination location settings.
  const destinationLocationSettings = {
    ...getDestinationLocationSettings(dataSyncProvider),
    LocationUri: new RegExp(`^s3://${dataSyncProvider.datasetsBucketName}`),
  };
  const destinationLocationSettingSchema = Joi.compile(destinationLocationSettings);
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
  const destinationLocationValidationResults = destinationLocationSettingSchema.validate(
    describeLocationResponse,
    { allowUnknown: true }
  );
  if (destinationLocationValidationResults.error) {
    logger.info(
      'Destination Location is not properly set',
      destinationLocationValidationResults.error.details
    );
    throw new ValidationError('Destination Location is not properly set');
  }

  return {
    taskId: taskArn.split('/')[1],
    dataVaultUlid: getDataVaultUlid(describeLocationResponse.LocationUri),
    name: describeTaskResponse.Name || '',
    destinationFolder: getDestinationFolder(describeLocationResponse.LocationUri),
    sourceLocationArn: describeTaskResponse.SourceLocationArn || '',
    destinationLocationArn: destinationLocationArn || '',
    taskArn: taskArn,
    deleted: false,
  };
};
