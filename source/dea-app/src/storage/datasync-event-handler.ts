/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Context, Callback, S3Event } from 'aws-lambda';
import { ValidationError } from '../app/exceptions/validation-exception';
import { describeDatasyncLocation } from '../app/services/data-sync-service';
import { createDataVaultFiles } from '../app/services/data-vault-file-service';
import { logger } from '../logger';
import { DataVaultFileDTO } from '../models/data-vault-file';
import { taskReportJoi } from '../models/validation/joi-common';
import { updateDataVaultSize } from '../persistence/data-vault';
import { getDataVaultExecution } from '../persistence/data-vault-execution';
import { createDataVaultFile } from '../persistence/data-vault-file';
import { getDataVaultTask } from '../persistence/data-vault-task';
import { ModelRepositoryProvider, defaultProvider } from '../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from './datasets';
import { DataSyncProvider, defaultDataSyncProvider } from './dataSync';

interface FileData {
  TaskExecutionId: string;
  Verified: VerifiedFile[];
}

interface VerifiedFile {
  RelativePath: string;
  SrcMetadata: FileMetadata;
  SrcChecksum: string;
  DstMetadata: FileMetadata;
  DstChecksum: string;
  VerifyTimestamp: string;
  VerifyStatus: string;
}

interface FileMetadata {
  Type: string;
  ContentSize?: number;
  Mtime: string;
}

export const dataSyncExecutionEvent = async (
  event: S3Event,
  context: Context,
  _callback: Callback,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  dataSyncProvider: DataSyncProvider = defaultDataSyncProvider,
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<void> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });

  const s3Bucket = event.Records[0].s3.bucket.name;
  const s3Key = event.Records[0].s3.object.key;
  let executionId = '';
  // Check if object is verified task report
  if (taskReportJoi.validate(s3Key).error) {
    logger.info('Object is not a files-verified report', { s3Bucket, s3Key });
    return;
  } else {
    const regex = /Detailed-Reports\/task-[^/]+\/(exec-[^/]+)\/exec-[^/]+\.files-verified-[^/]+/;
    const match = s3Key.match(regex);
    if (match) {
      executionId = match[1];
    }
  }

  const dataVaultExecution = await getDataVaultExecution(executionId, repositoryProvider);
  if (!dataVaultExecution) {
    throw new Error(`Could not find DataVaultExecution with id ${executionId}`);
  }
  const dataVaultTask = await getDataVaultTask(dataVaultExecution.taskId, repositoryProvider);
  if (!dataVaultTask) {
    throw new Error(`Could not find DataVaultTask with id ${dataVaultExecution.taskId}`);
  }

  const locationDetails = await describeDatasyncLocation(
    dataVaultTask.destinationLocationArn,
    dataSyncProvider
  );
  if (!locationDetails || !locationDetails.LocationUri) {
    throw new Error('Could not find location details');
  }

  const params = {
    Bucket: s3Bucket,
    Key: s3Key,
  };

  const getObjectCommand = new GetObjectCommand(params);
  const response = await datasetsProvider.s3Client.send(getObjectCommand);

  // Create Prefix Directory DataVaultFile Entries
  const prefixString = await generateFolderPrefixEntries(
    locationDetails.LocationUri,
    dataVaultTask.dataVaultUlid,
    dataVaultExecution.createdBy,
    executionId,
    repositoryProvider
  );

  const filesList = [];

  let totalFileCount = 0;
  let totalFileSizeInBytes = 0;
  if (response.Body) {
    const responseStr = await response.Body.transformToString();
    const fileData: FileData = JSON.parse(responseStr);

    for (const file of fileData.Verified) {
      logger.debug('Processing File', { Data: JSON.stringify(file, null, 2) });

      // Skip root directory
      if (file.RelativePath == '/' && file.DstMetadata.Type == 'Directory') {
        continue;
      }

      // Construct file details
      const fileName = fetchFileName(file.RelativePath);
      const filePath = prefixString + fetchFilePath(file.RelativePath, fileName);
      const fileS3Key = fetchS3Key(
        locationDetails.LocationUri,
        dataVaultTask.dataVaultUlid,
        file.RelativePath
      );

      if (file.DstMetadata.Type == 'Directory') {
        const dataVaultFileDTO: DataVaultFileDTO = {
          fileName: fileName,
          filePath: filePath,
          dataVaultUlid: dataVaultTask.dataVaultUlid,
          isFile: false,
          fileSizeBytes: 0,
          createdBy: dataVaultExecution.createdBy,
          contentType: file.SrcMetadata.Type,
          fileS3Key: fileS3Key,
          executionId: dataVaultExecution.executionId,
        };

        filesList.push(dataVaultFileDTO);
      } else {
        const fileExtension = fetchFileExtension(file.SrcMetadata.Type, fileName);

        const dataVaultFileDTO: DataVaultFileDTO = {
          fileName: fileName,
          filePath: filePath,
          dataVaultUlid: dataVaultTask.dataVaultUlid,
          isFile: true,
          fileSizeBytes: file.SrcMetadata.ContentSize || 0,
          createdBy: dataVaultExecution.createdBy,
          contentType: fileExtension,
          sha256Hash: file.DstChecksum,
          fileS3Key: fileS3Key,
          executionId: dataVaultExecution.executionId,
        };

        filesList.push(dataVaultFileDTO);

        totalFileCount = totalFileCount + 1;
        totalFileSizeInBytes = totalFileSizeInBytes + (file.SrcMetadata.ContentSize || 0);
      }
    }

    // send files list to batch create
    await createDataVaultFiles(filesList, repositoryProvider);

    // update with final size and count
    await updateDataVaultSize(
      dataVaultTask.dataVaultUlid,
      totalFileCount,
      totalFileSizeInBytes,
      repositoryProvider
    );
  }
};

export const fetchS3Key = (locationUri: string, dataVaultUlid: string, relativePath: string) => {
  const dataVaultUlidString = `DATAVAULT${dataVaultUlid}`;
  const index = locationUri.indexOf(dataVaultUlidString);

  if (index !== -1) {
    const s3Key = `${locationUri.substring(index, locationUri.length - 1)}${relativePath}`;
    return s3Key;
  } else {
    throw new ValidationError('DataVault Ulid not found in Location URI');
  }
};

export const fetchFileName = (relativePath: string) => {
  const index = relativePath.lastIndexOf('/');
  if (index !== -1) {
    return relativePath.substring(index + 1);
  } else {
    return relativePath;
  }
};

export const fetchFilePath = (relativePath: string, fileName: string) => {
  const folderPath = relativePath.substring(0, relativePath.lastIndexOf(fileName));
  return folderPath;
};

export const fetchFileExtension = (contentType: string, fileName: string) => {
  if (fileName.includes('.')) {
    const parts = fileName.split('.');
    const extension = parts[parts.length - 1];
    return extension;
  } else {
    return contentType;
  }
};

export const generateFolderPrefixEntries = async (
  locationUri: string,
  dataVaultUlid: string,
  userUlid: string,
  executionId: string,
  repositoryProvider: ModelRepositoryProvider
) => {
  const dataVaultUlidString = `DATAVAULT${dataVaultUlid}`;
  const prefixString = locationUri.substring(
    locationUri.indexOf(dataVaultUlidString) + dataVaultUlidString.length
  );

  if (prefixString !== '/') {
    const parts = prefixString.split('/').filter((part) => part !== '');

    let folderPath = '/';
    for (let i = 0; i < parts.length; i++) {
      const folderName = parts[i];
      try {
        await createDataVaultFile(
          [
            {
              fileName: folderName,
              filePath: folderPath,
              dataVaultUlid: dataVaultUlid,
              isFile: false,
              fileSizeBytes: 0,
              createdBy: userUlid,
              contentType: 'Directory',
              fileS3Key: folderPath,
              executionId: executionId,
            },
          ],
          repositoryProvider
        );
      } catch (error) {
        if ('code' in error && error.code === 'UniqueError') {
          logger.debug(`${folderName} at ${folderPath} already exists, moving on...`);
        } else {
          throw error;
        }
      }

      folderPath += `${parts[i]}/`;
    }
  }

  return prefixString.substring(0, prefixString.length - 1);
};
