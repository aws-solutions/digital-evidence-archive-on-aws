/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  DataSyncClient,
  DeleteLocationCommand,
  DeleteTaskCommand,
  DescribeTaskExecutionCommand,
  OverwriteMode,
  PreserveDeletedFiles,
  ReportLevel,
  ReportOutputType,
  S3StorageClass,
  TaskExecutionStatus,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../../models/auth';
import { CaseAssociationDTO, DeaCaseFileResult, RemoveCaseAssociationDTO } from '../../../models/case-file';
import { DeaDataVault, DeaDataVaultInput, DeaDataVaultUpdateInput } from '../../../models/data-vault';
import { DeaDataVaultExecution, DataVaultExecutionDTO } from '../../../models/data-vault-execution';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import { DeaDataVaultTask, DataVaultTaskDTO } from '../../../models/data-vault-task';
import {
  dataVaultResponseSchema,
  dataVaultExecutionResponseSchema,
  dataVaultTaskResponseSchema,
} from '../../../models/validation/data-vault';
import { testEnv } from '../../helpers/settings';
import {
  callDeaAPIWithCreds,
  delay,
  MINUTES_TO_MILLISECONDS,
  verifyDeaRequestSuccess,
} from '../test-helpers';

const dataSyncClient = new DataSyncClient({ region: testEnv.awsRegion });

const EXECUTION_STATUS_WAIT_TIME = 3 * MINUTES_TO_MILLISECONDS;
const EXECUTION_STATUS_RETRIES = 20;
const LIST_QUERY_LIMIT = 1000;

export async function createDataVaultSuccess(
  baseUrl: string,
  deaDataVault: DeaDataVaultInput,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DeaDataVault> {
  const response = await callDeaAPIWithCreds(`${baseUrl}datavaults`, 'POST', idToken, creds, deaDataVault);

  verifyDeaRequestSuccess(response);

  const createdVault: DeaDataVault = response.data;
  Joi.assert(createdVault, dataVaultResponseSchema);
  expect(createdVault.name).toEqual(deaDataVault.name);
  return createdVault;
}

export async function updateDataVaultSuccess(
  baseUrl: string,
  dataVaultId: string,
  deaDataVault: DeaDataVaultUpdateInput,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DeaDataVault> {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/details`,
    'PUT',
    idToken,
    creds,
    deaDataVault
  );

  verifyDeaRequestSuccess(response);

  const updatedVault: DeaDataVault = response.data;
  Joi.assert(updatedVault, dataVaultResponseSchema);
  expect(updatedVault.name).toEqual(deaDataVault.name);
  return updatedVault;
}

type DataVaultsResponse = {
  dataVaults: DeaDataVault[];
  total: number;
  next: string;
};

export async function listDataVaultsSuccess(
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DataVaultsResponse> {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults?limit=${LIST_QUERY_LIMIT}`,
    'GET',
    idToken,
    creds
  );

  verifyDeaRequestSuccess(response);

  const vaults: DataVaultsResponse = response.data;
  return vaults;
}

export const describeDataVaultDetailsSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string
): Promise<DeaDataVault> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/details`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const createDataVaultTaskSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  deaDataVaultTask: DataVaultTaskDTO
): Promise<DeaDataVaultTask> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/tasks`,
    'POST',
    idToken,
    creds,
    deaDataVaultTask
  );

  verifyDeaRequestSuccess(response);

  const createdTask: DeaDataVaultTask = response.data;
  Joi.assert(createdTask, dataVaultTaskResponseSchema);
  expect(createdTask.name).toEqual(deaDataVaultTask.name);
  return createdTask;
};

export const listDataSyncTasksSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DeaDataVaultTask[]> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datasync/tasks?limit=${LIST_QUERY_LIMIT}`,
    'GET',
    idToken,
    creds
  );

  verifyDeaRequestSuccess(response);

  const tasks: DeaDataVaultTask[] = response.data.dataSyncTasks;
  return tasks;
};

export const createDataVaultExecutionSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  taskId: string,
  deaDataVaultExecution: DataVaultExecutionDTO
): Promise<DeaDataVaultExecution> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/tasks/${taskId}/executions`,
    'POST',
    idToken,
    creds,
    deaDataVaultExecution
  );

  verifyDeaRequestSuccess(response);

  const createdExecution: DeaDataVaultExecution = response.data;
  Joi.assert(createdExecution, dataVaultExecutionResponseSchema);
  expect(createdExecution.taskId).toEqual(deaDataVaultExecution.taskArn.split('/')[1]);
  return createdExecution;
};

export const listDataVaultFilesSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  filePath?: string
): Promise<DeaDataVaultFile[]> => {
  const url = filePath
    ? `${baseUrl}datavaults/${dataVaultId}/files?filePath=${filePath}`
    : `${baseUrl}datavaults/${dataVaultId}/files`;
  const response = await callDeaAPIWithCreds(url, 'GET', idToken, creds);

  verifyDeaRequestSuccess(response);

  const files: DeaDataVaultFile[] = response.data.files;
  return files;
};

export const describeDataVaultFileDetailsSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  fileUlid: string
): Promise<DeaDataVaultFile> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/files/${fileUlid}/info`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const createCaseAssociationSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  associationDTO: CaseAssociationDTO
): Promise<DeaCaseFileResult[]> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/caseAssociations`,
    'POST',
    idToken,
    creds,
    associationDTO
  );

  expect(response.status).toEqual(200);
  return response.data.filesTransferred;
};

export const deleteCaseAssociationSuccess = async (
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  fileId: string,
  associationDTO: RemoveCaseAssociationDTO
): Promise<DeaDataVaultFile> => {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/files/${fileId}/caseAssociations`,
    'DELETE',
    idToken,
    creds,
    associationDTO
  );

  // Since we have to have data in the body for a DELETE Request we get 204 back instead of 200
  expect(response.status).toEqual(204);
  return response.data;
};

// Data Sync SDK Helpers

export const createS3DataSyncLocation = async (bucketArn: string, folder?: string): Promise<string> => {
  const locationArn = (
    await dataSyncClient.send(
      new CreateLocationS3Command({
        S3BucketArn: bucketArn,
        S3Config: {
          BucketAccessRoleArn: testEnv.DataSyncRole,
        },
        Subdirectory: folder,
        S3StorageClass: S3StorageClass.INTELLIGENT_TIERING,
      })
    )
  ).LocationArn;

  if (!locationArn) {
    throw new Error('Unable to create DataSync Location');
  }

  return locationArn;
};

export const deleteS3DataSyncLocation = async (locationArn: string) => {
  await dataSyncClient.send(
    new DeleteLocationCommand({
      LocationArn: locationArn,
    })
  );
};

export const deleteDataSyncTasks = async (taskArns: string[]) => {
  for (const taskArn of taskArns) {
    await dataSyncClient.send(
      new DeleteTaskCommand({
        TaskArn: taskArn,
      })
    );
  }
};

const taskIsComplete = (status?: TaskExecutionStatus): boolean => {
  if (!status) {
    return false;
  }

  if (status === TaskExecutionStatus.ERROR) {
    return true;
  }

  if (status === TaskExecutionStatus.SUCCESS) {
    return true;
  }

  return false;
};

export const waitForTaskExecutionCompletions = async (
  taskArns: string[],
  waitTime?: number,
  retries?: number
): Promise<Map<string, TaskExecutionStatus>> => {
  const taskStatusMap: Map<string, TaskExecutionStatus> = new Map();

  const uncompletedTasks = new Set(taskArns);
  const maxRetries = retries ?? EXECUTION_STATUS_RETRIES;
  let attempt = 0;
  while (uncompletedTasks.size > 0 && attempt < maxRetries) {
    console.log(`Waiting on ${uncompletedTasks.size} tasks, attempt number ${attempt}`);
    for (const taskArn of uncompletedTasks.values()) {
      const status = (
        await dataSyncClient.send(
          new DescribeTaskExecutionCommand({
            TaskExecutionArn: taskArn,
          })
        )
      ).Status;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      taskStatusMap.set(taskArn, status!);
      if (taskIsComplete(status)) {
        uncompletedTasks.delete(taskArn);
      }
    }
    attempt++;

    if (uncompletedTasks.size > 0) {
      console.log(`${uncompletedTasks.size} tasks did not complete, Sleeping for 3 minutes... `);
      await delay(waitTime ?? EXECUTION_STATUS_WAIT_TIME);
    }
  }

  return taskStatusMap;
};

export const verifyAllExecutionsSucceeded = (taskStatuses: Map<string, TaskExecutionStatus>): boolean => {
  return (
    Array.from(taskStatuses.values()).filter((status) => status != TaskExecutionStatus.SUCCESS).length == 0
  );
};

// TODO: Create Data Sync Task Using the SDK to mimic the console experience of
// the user who uses Data Sync directly for mass ingestion
export const createDataSyncTaskWithSDKSuccess = async (
  name: string,
  sourceLocationArn: string,
  destinationLocationArn: string
): Promise<string> => {
  const response = await dataSyncClient.send(
    new CreateTaskCommand({
      SourceLocationArn: sourceLocationArn,
      DestinationLocationArn: destinationLocationArn,
      Name: name,
      Options: {
        VerifyMode: VerifyMode.ONLY_FILES_TRANSFERRED,
        OverwriteMode: OverwriteMode.NEVER,
        PreserveDeletedFiles: PreserveDeletedFiles.PRESERVE,
      },
      TaskReportConfig: {
        Destination: {
          S3: {
            S3BucketArn: `arn:aws:s3:::${testEnv.DataSyncReportsBucket}`,
            BucketAccessRoleArn: testEnv.DataSyncReportsRole,
          },
        },
        OutputType: ReportOutputType.STANDARD,
        ReportLevel: ReportLevel.SUCCESSES_AND_ERRORS,
      },
    })
  );

  if (!response.TaskArn) {
    throw new Error('Unable to create data sync task using the sdk.');
  }

  return response.TaskArn;
};
