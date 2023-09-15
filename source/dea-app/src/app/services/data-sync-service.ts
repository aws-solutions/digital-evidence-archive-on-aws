/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  DeleteLocationCommand,
  DeleteTaskCommand,
} from '@aws-sdk/client-datasync';
import { DataSyncProvider } from '../../storage/dataSync';
import { ValidationError } from '../exceptions/validation-exception';

export const createS3Location = async (
  s3BucketPrefix: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const locationSettings = {
    Subdirectory: s3BucketPrefix,
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
  };

  const command = new CreateTaskCommand(taskSettings);

  const response = await dataSyncProvider.dataSyncClient.send(command);
  if (response.TaskArn) {
    return response.TaskArn;
  } else {
    throw new ValidationError('Task creation failed');
  }
};

export const deleteDatasyncLocation = async (
  locationArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const command = new DeleteLocationCommand({
    LocationArn: locationArn,
  });

  try {
    await dataSyncProvider.dataSyncClient.send(command);
  } catch (error) {
    throw new ValidationError('Error deleting DataSync Location');
  }

  return locationArn;
};

export const deleteDatasyncTask = async (
  taskArn: string,
  dataSyncProvider: DataSyncProvider
): Promise<string> => {
  const command = new DeleteTaskCommand({
    TaskArn: taskArn,
  });

  try {
    await dataSyncProvider.dataSyncClient.send(command);
  } catch (error) {
    throw new ValidationError('Error deleting DataSync Task');
  }

  return taskArn;
};
