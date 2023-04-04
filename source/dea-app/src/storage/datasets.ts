/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  ListPartsOutput,
  Part,
  PutObjectLegalHoldCommand,
  PutObjectCommand,
  ObjectLockLegalHoldStatus,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { S3ControlClient, CreateJobCommand, JobReportScope } from '@aws-sdk/client-s3-control';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getRequiredEnv } from '../lambda-http-helpers';
import { logger } from '../logger';
import { DeaCaseFile } from '../models/case-file';

const region = process.env.AWS_REGION;

export interface DatasetsProvider {
  s3Client: S3Client;
  bucketName: string;
  presignedCommandExpirySeconds: number;
  s3BatchDeleteCaseFileLambdaArn: string;
  s3BatchDeleteCaseFileLambdaRole: string;
}

export const defaultDatasetsProvider = {
  s3Client: new S3Client({ region }),
  region: region,
  bucketName: getRequiredEnv('DATASETS_BUCKET_NAME', 'DATASETS_BUCKET_NAME is not set in your lambda!'),
  s3BatchDeleteCaseFileLambdaArn: getRequiredEnv(
    'DELETE_CASE_FILE_LAMBDA_ARN',
    'DELETE_CASE_FILE_LAMBDA_ARN is not set in your lambda!'
  ),
  s3BatchDeleteCaseFileLambdaRole: getRequiredEnv(
    'DELETE_CASE_FILE_LAMBDA_ROLE',
    'DELETE_CASE_FILE_LAMBDA_ROLE is not set in your lambda!'
  ),
  presignedCommandExpirySeconds: 3600,
};

export const generatePresignedUrlsForCaseFile = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider,
  chunkSizeMb: number
): Promise<void> => {
  const s3Key = _getS3KeyForCaseFile(caseFile);
  logger.info('Initiating multipart upload.', { s3Key });
  const response = await datasetsProvider.s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      BucketKeyEnabled: true,
      ServerSideEncryption: 'aws:kms',
      ContentType: caseFile.contentType,
      StorageClass: 'INTELLIGENT_TIERING',
    })
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const uploadId = response.UploadId as string;

  const fileParts = Math.max(Math.ceil(caseFile.fileSizeMb / chunkSizeMb), 1);

  logger.info('Generating presigned URLs.', { fileParts, s3Key });
  const presignedUrlPromises = [];
  for (let i = 0; i < fileParts; i++) {
    presignedUrlPromises[i] = _getUploadPresignedUrlPromise(s3Key, uploadId, i + 1, datasetsProvider);
  }
  await Promise.all(presignedUrlPromises).then((presignedUrls) => {
    caseFile.presignedUrls = presignedUrls;
  });

  logger.info('Generated presigned URLs.', { s3Key });
  caseFile.uploadId = uploadId;
};

export const completeUploadForCaseFile = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider
): Promise<void> => {
  let uploadedParts: Part[] = [];
  let listPartsResponse: ListPartsOutput;
  let partNumberMarker;
  const s3Key = _getS3KeyForCaseFile(caseFile);
  logger.info('Collecting upload parts.', { s3Key });

  /* eslint-disable no-await-in-loop */
  do {
    listPartsResponse = await datasetsProvider.s3Client.send(
      new ListPartsCommand({
        Bucket: datasetsProvider.bucketName,
        Key: s3Key,
        PartNumberMarker: partNumberMarker,
        UploadId: caseFile.uploadId,
      })
    );
    if (listPartsResponse !== undefined && listPartsResponse.Parts) {
      uploadedParts = uploadedParts.concat(
        listPartsResponse.Parts.map(function (part) {
          return { ETag: part.ETag, PartNumber: part.PartNumber };
        })
      );
    }

    partNumberMarker = listPartsResponse.NextPartNumberMarker;
  } while (listPartsResponse.IsTruncated);

  logger.info('Collected all parts. Marking upload as completed.', {
    collectedParts: uploadedParts.length,
    s3Key,
  });

  const uploadResponse = await datasetsProvider.s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      UploadId: caseFile.uploadId,
      MultipartUpload: { Parts: uploadedParts },
    })
  );
  caseFile.versionId = uploadResponse.VersionId;

  logger.info('Marked upload as completed. Putting legal hold on object..', { s3Key });
  await datasetsProvider.s3Client.send(
    new PutObjectLegalHoldCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      LegalHold: { Status: ObjectLockLegalHoldStatus.ON },
    })
  );
};

export const getPresignedUrlForDownload = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider
): Promise<string> => {
  const s3Key = _getS3KeyForCaseFile(caseFile);

  logger.info('Creating presigned URL for caseFile.', caseFile);
  const getObjectCommand = new GetObjectCommand({
    Bucket: datasetsProvider.bucketName,
    Key: s3Key,
    VersionId: caseFile.versionId,
    ResponseContentType: caseFile.contentType,
    ResponseContentDisposition: `attachment; filename="${caseFile.fileName}"`,
  });
  return getSignedUrl(datasetsProvider.s3Client, getObjectCommand, {
    expiresIn: datasetsProvider.presignedCommandExpirySeconds,
  });
};

export const startDeleteCaseFilesS3BatchJob = async (
  caseId: string,
  s3FileKeys: string[],
  datasetsProvider: DatasetsProvider
): Promise<string | undefined> => {
  if (s3FileKeys.length === 0) {
    logger.info('Not starting delete batch job because there are no files to delete');
    return;
  }
  logger.info('Creating delete files batch job', { fileCount: s3FileKeys.length, caseId });

  const manifestFileName = `delete-case-file-manifests/case-${caseId}-delete-files-job-${Date.now()}.csv`;
  const manifestFileEtag = await _createJobManifestFile(s3FileKeys, manifestFileName, datasetsProvider);
  return _createDeleteCaseFileBatchJob(manifestFileName, manifestFileEtag, datasetsProvider);
};

async function _createJobManifestFile(
  s3FileKeys: string[],
  manifestFileName: string,
  datasetsProvider: DatasetsProvider
): Promise<string> {
  logger.info('Creating job manifest file', { manifestFileName });
  const bucketName = datasetsProvider.bucketName;
  const manifestCsv = s3FileKeys.map((key) => `${bucketName},${key}`).join('\r\n');

  console.log(manifestCsv);
  const response = await datasetsProvider.s3Client.send(
    new PutObjectCommand({
      Key: manifestFileName,
      Bucket: bucketName,
      Body: manifestCsv,
    })
  );
  console.log('Created job manifest file successfully', {
    manifestFileName,
    etag: response.ETag,
  });
  if (!response.ETag) {
    throw new Error('Failed to create delete files job manifest');
  }
  return response.ETag;
}

const _createDeleteCaseFileBatchJob = async (
  manifestFileName: string,
  manifestFileEtag: string,
  datasetsProvider: DatasetsProvider
) => {
  const client = new S3ControlClient({ region });
  const accountId = datasetsProvider.s3BatchDeleteCaseFileLambdaRole.split(':')[4];
  const input = {
    ConfirmationRequired: false,
    AccountId: accountId,
    RoleArn: datasetsProvider.s3BatchDeleteCaseFileLambdaRole,
    Priority: 1,
    Operation: {
      LambdaInvoke: {
        FunctionArn: datasetsProvider.s3BatchDeleteCaseFileLambdaArn,
      },
    },
    Report: {
      Enabled: true,
      Bucket: datasetsProvider.bucketName,
      Prefix: 'delete-case-file-reports',
      Format: 'Report_CSV_20180820',
      ReportScope: JobReportScope.AllTasks,
    },
    Manifest: {
      Spec: {
        Format: 'S3BatchOperations_CSV_20180820',
        Fields: ['Bucket', 'Key'],
      },
      Location: {
        ObjectArn: `s3://${datasetsProvider.bucketName}/${manifestFileName}`,
        ETag: manifestFileEtag,
      },
    },
  };

  const result = await client.send(new CreateJobCommand(input));
  if (!result.JobId) {
    throw new Error('Failed to create delete files batch job.');
  }
  return result.JobId;
};

function _getS3KeyForCaseFile(caseFile: DeaCaseFile): string {
  return `${caseFile.caseUlid}/${caseFile.ulid}`;
}

async function _getUploadPresignedUrlPromise(
  s3Key: string,
  uploadId: string,
  partNumber: number,
  datasetsProvider: DatasetsProvider
): Promise<string> {
  const uploadPartCommand = new UploadPartCommand({
    Bucket: datasetsProvider.bucketName,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(datasetsProvider.s3Client, uploadPartCommand, {
    expiresIn: datasetsProvider.presignedCommandExpirySeconds,
  });
}
