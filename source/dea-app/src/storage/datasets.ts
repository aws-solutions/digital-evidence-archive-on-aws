/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  ChecksumAlgorithm,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListPartsCommand,
  ListPartsOutput,
  ObjectLockLegalHoldStatus,
  Part,
  PutObjectCommand,
  PutObjectLegalHoldCommand,
  RestoreObjectCommand,
  S3Client,
  StorageClass,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import {
  CreateJobCommand,
  DescribeJobCommand,
  DescribeJobResult,
  JobReportScope,
  S3ControlClient,
} from '@aws-sdk/client-s3-control';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { getRequiredEnv } from '../lambda-http-helpers';
import { logger } from '../logger';
import { DeaCaseFile, DownloadCaseFileResult } from '../models/case-file';

const region = process.env.AWS_REGION;

export interface DatasetsProvider {
  s3Client: S3Client;
  bucketName: string;
  presignedCommandExpirySeconds: number;
  s3BatchDeleteCaseFileLambdaArn: string;
  s3BatchDeleteCaseFileRole: string;
}

export interface S3Object {
  key: string;
  versionId: string;
}

export const defaultDatasetsProvider = {
  s3Client: new S3Client({ region }),
  region: region,
  bucketName: getRequiredEnv('DATASETS_BUCKET_NAME', 'DATASETS_BUCKET_NAME is not set in your lambda!'),
  s3BatchDeleteCaseFileLambdaArn: getRequiredEnv(
    'DELETE_CASE_FILE_LAMBDA_ARN',
    'DELETE_CASE_FILE_LAMBDA_ARN is not set in your lambda!'
  ),
  s3BatchDeleteCaseFileRole: getRequiredEnv(
    'DELETE_CASE_FILE_ROLE',
    'DELETE_CASE_FILE_ROLE is not set in your lambda!'
  ),
  presignedCommandExpirySeconds: 3600,
};

export const generatePresignedUrlsForCaseFile = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider,
  chunkSizeBytes: number,
  partsChecksum: string[]
): Promise<void> => {
  const s3Key = getS3KeyForCaseFile(caseFile);
  logger.info('Initiating multipart upload.', { s3Key });
  const response = await datasetsProvider.s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      BucketKeyEnabled: true,
      ServerSideEncryption: 'aws:kms',
      ContentType: caseFile.contentType,
      StorageClass: 'INTELLIGENT_TIERING',
      ChecksumAlgorithm: ChecksumAlgorithm.SHA256,
    })
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const uploadId = response.UploadId as string;

  const fileParts = Math.max(Math.ceil(caseFile.fileSizeBytes / chunkSizeBytes), 1);

  logger.info('Generating presigned URLs.', { fileParts, s3Key });
  const presignedUrlPromises = [];
  for (let i = 0; i < fileParts; i++) {
    presignedUrlPromises[i] = getUploadPresignedUrlPromise(
      s3Key,
      uploadId,
      i + 1,
      partsChecksum[i],
      datasetsProvider
    );
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
  const s3Key = getS3KeyForCaseFile(caseFile);
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
      VersionId: uploadResponse.VersionId,
    })
  );
};

export const getPresignedUrlForDownload = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider
): Promise<DownloadCaseFileResult> => {
  const s3Key = getS3KeyForCaseFile(caseFile);

  const headObjectResponse = await datasetsProvider.s3Client.send(
    new HeadObjectCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      VersionId: caseFile.versionId,
    })
  );

  logger.info('Checking if caseFile is archived', headObjectResponse);

  const result: DownloadCaseFileResult = { isArchived: false, isRestoring: false };

  if (isS3ObjectArchived(headObjectResponse)) {
    logger.info('CaseFile is archived.');
    result.isArchived = true;
    if (headObjectResponse.Restore === 'ongoing-request="true"') {
      logger.info('CaseFile is archived and has an active restore job');
      result.isRestoring = true;
      return result;
    }

    if (!headObjectResponse.Restore) {
      logger.info('CaseFile is archived and is not being restored');
      result.isRestoring = false;
      return result;
    }

    logger.info('CaseFile is archived, but has a restored object available for download');
  }

  logger.info('Creating presigned URL for caseFile.', caseFile);
  const getObjectCommand = new GetObjectCommand({
    Bucket: datasetsProvider.bucketName,
    Key: s3Key,
    VersionId: caseFile.versionId,
    ResponseContentType: caseFile.contentType,
    ResponseContentDisposition: `attachment; filename="${caseFile.fileName}"`,
  });
  result.downloadUrl = await getSignedUrl(datasetsProvider.s3Client, getObjectCommand, {
    expiresIn: datasetsProvider.presignedCommandExpirySeconds,
  });
  return result;
};

export const restoreObject = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider
): Promise<void> => {
  const s3Key = getS3KeyForCaseFile(caseFile);

  const headObjectResponse = await datasetsProvider.s3Client.send(
    new HeadObjectCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      VersionId: caseFile.versionId,
    })
  );

  logger.info('Checking if caseFile is archived', headObjectResponse);

  if (!isS3ObjectArchived(headObjectResponse)) {
    logger.info('CaseFile is not archived. Do nothing');
    return;
  }

  if (headObjectResponse.Restore) {
    logger.info('CaseFile is already restoring. Do nothing');
    return;
  }

  // Days param isn't accepted for intelligent-tier objects and is mandatory for other archive storage classes
  // source: https://github.com/awsdocs/amazon-s3-developer-guide/blob/master/doc_source/restoring-objects.md?plain=1#L8
  const RestoreRequest =
    headObjectResponse.StorageClass === StorageClass.INTELLIGENT_TIERING ? undefined : { Days: 10 };

  logger.info('Restoring caseFile..', caseFile);
  await datasetsProvider.s3Client.send(
    new RestoreObjectCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      VersionId: caseFile.versionId,
      RestoreRequest,
    })
  );

  return;
};

function isS3ObjectArchived(headObjectResponse: HeadObjectCommandOutput): boolean {
  if (
    headObjectResponse.ArchiveStatus &&
    ['DEEP_ARCHIVE_ACCESS', 'ARCHIVE_ACCESS'].includes(headObjectResponse.ArchiveStatus)
  ) {
    return true;
  }
  if (
    headObjectResponse.StorageClass &&
    ['DEEP_ARCHIVE', 'GLACIER'].includes(headObjectResponse.StorageClass)
  ) {
    return true;
  }

  return false;
}

export const startDeleteCaseFilesS3BatchJob = async (
  caseId: string,
  s3Objects: S3Object[],
  datasetsProvider: DatasetsProvider
): Promise<string | undefined> => {
  if (s3Objects.length === 0) {
    logger.info('Not starting delete batch job because there are no files to delete');
    return;
  }
  logger.info('Creating delete files batch job', { fileCount: s3Objects.length, caseId });

  const manifestFileName = `manifests/case-${caseId}-delete-files-job-${Date.now()}.csv`;
  const manifestFileEtag = await createJobManifestFile(s3Objects, manifestFileName, datasetsProvider);
  const etag = manifestFileEtag.replace(/^"(.*)"$/, '$1');
  return createDeleteCaseFileBatchJob(manifestFileName, etag, datasetsProvider);
};

export const deleteCaseFile = async (
  s3Key: string,
  s3VersionId: string,
  datasetsProvider: DatasetsProvider
): Promise<void> => {
  await datasetsProvider.s3Client.send(
    new PutObjectLegalHoldCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      LegalHold: { Status: ObjectLockLegalHoldStatus.OFF },
      VersionId: s3VersionId,
    })
  );

  await datasetsProvider.s3Client.send(
    new DeleteObjectCommand({
      Bucket: datasetsProvider.bucketName,
      Key: s3Key,
      VersionId: s3VersionId,
    })
  );
};

export const describeS3BatchJob = async (JobId: string, AccountId: string): Promise<DescribeJobResult> => {
  const s3ControlClient = new S3ControlClient({ region });
  return s3ControlClient.send(new DescribeJobCommand({ JobId, AccountId }));
};

async function createJobManifestFile(
  s3Objects: S3Object[],
  manifestFileName: string,
  datasetsProvider: DatasetsProvider
): Promise<string> {
  logger.info('Creating job manifest file', { manifestFileName });
  const bucketName = datasetsProvider.bucketName;
  const manifestCsv = s3Objects.map((key) => `${bucketName},${key.key},${key.versionId}`).join('\r\n');

  const response = await datasetsProvider.s3Client.send(
    new PutObjectCommand({
      Key: manifestFileName,
      Bucket: bucketName,
      Body: manifestCsv,
      // S3 batch doesn't support kms encrypted manifest files
      ServerSideEncryption: 'AES256',
      BucketKeyEnabled: false,
    })
  );
  logger.info('Created job manifest file successfully', {
    manifestFileName,
    etag: response.ETag,
  });
  if (!response.ETag) {
    throw new Error('Failed to create delete files job manifest');
  }
  return response.ETag;
}

const createDeleteCaseFileBatchJob = async (
  manifestFileName: string,
  manifestFileEtag: string,
  datasetsProvider: DatasetsProvider
): Promise<string> => {
  const accountId = datasetsProvider.s3BatchDeleteCaseFileRole.split(':')[4];
  const input = {
    ConfirmationRequired: false,
    AccountId: accountId,
    RoleArn: datasetsProvider.s3BatchDeleteCaseFileRole,
    Priority: 1,
    ClientRequestToken: uuidv4(),
    Operation: {
      LambdaInvoke: {
        FunctionArn: datasetsProvider.s3BatchDeleteCaseFileLambdaArn,
      },
    },
    Report: {
      Enabled: true,
      Bucket: `arn:aws:s3:::${datasetsProvider.bucketName}`,
      Prefix: 'reports',
      Format: 'Report_CSV_20180820',
      ReportScope: JobReportScope.AllTasks,
    },
    Manifest: {
      Spec: {
        Format: 'S3BatchOperations_CSV_20180820',
        Fields: ['Bucket', 'Key', 'VersionId'],
      },
      Location: {
        ObjectArn: `arn:aws:s3:::${datasetsProvider.bucketName}/${manifestFileName}`,
        ETag: manifestFileEtag,
      },
    },
  };
  logger.debug('CreateJobCommand Input', input);

  const s3ControlClient = new S3ControlClient({ region });
  const result = await s3ControlClient.send(new CreateJobCommand(input));
  if (!result.JobId) {
    throw new Error('Failed to create delete files batch job.');
  }
  return result.JobId;
};

function getS3KeyForCaseFile(caseFile: DeaCaseFile): string {
  return `${caseFile.caseUlid}/${caseFile.ulid}`;
}

async function getUploadPresignedUrlPromise(
  s3Key: string,
  uploadId: string,
  partNumber: number,
  partChecksum: string,
  datasetsProvider: DatasetsProvider
): Promise<string> {
  const uploadPartCommand = new UploadPartCommand({
    Bucket: datasetsProvider.bucketName,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: partNumber,
    ChecksumSHA256: partChecksum,
  });
  return getSignedUrl(datasetsProvider.s3Client, uploadPartCommand, {
    expiresIn: datasetsProvider.presignedCommandExpirySeconds,
    unhoistableHeaders: new Set(['x-amz-sdk-checksum-algorithm', 'x-amz-checksum-sha256']),
  });
}
