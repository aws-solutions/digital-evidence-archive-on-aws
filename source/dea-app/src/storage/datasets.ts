/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  AbortMultipartUploadCommand,
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
} from '@aws-sdk/client-s3';
import {
  CreateJobCommand,
  CreateJobCommandInput,
  DescribeJobCommand,
  DescribeJobResult,
  JobReportScope,
  S3ControlClient,
} from '@aws-sdk/client-s3-control';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { AssumeRoleCommand, AssumeRoleCommandInput, STSClient } from '@aws-sdk/client-sts';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ulid } from 'ulid';
import { v4 as uuidv4 } from 'uuid';
import { MultipartChecksumBody } from '../app/event-handlers/calculate-incremental-checksum';
import { getCustomUserAgent, getRequiredEnv } from '../lambda-http-helpers';
import { logger } from '../logger';
import {
  CompleteCaseFileUploadObject,
  DeaCaseFile,
  DeaCaseFileUpload,
  DownloadCaseFileResult,
} from '../models/case-file';
import { restrictAccountStatement } from './restrict-account-statement';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
const SQS_BATCH_LIMIT = 10;

export interface DatasetsProvider {
  s3Client: S3Client;
  bucketName: string;
  uploadPresignedCommandExpirySeconds: number;
  downloadPresignedCommandExpirySeconds: number;
  s3BatchDeleteCaseFileLambdaArn: string;
  s3BatchDeleteCaseFileRole: string;
  sourceIpValidationEnabled: boolean;
  deletionAllowed: boolean;
  datasetsRole: string;
  endUserUploadRole: string;
  awsPartition: string;
  checksumQueueUrl: string;
}

export interface S3Object {
  key: string;
  versionId: string;
}

const stsClient = new STSClient({ region, customUserAgent: getCustomUserAgent() });
const sqsClient = new SQSClient({ region, customUserAgent: getCustomUserAgent() });

export const defaultDatasetsProvider = {
  s3Client: new S3Client({ region, customUserAgent: getCustomUserAgent() }),
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
  sourceIpValidationEnabled: getRequiredEnv('SOURCE_IP_VALIDATION_ENABLED', 'true') === 'true',
  deletionAllowed: getRequiredEnv('DELETION_ALLOWED', 'false') === 'true',
  datasetsRole: getRequiredEnv('DATASETS_ROLE', 'DATASETS_ROLE is not set in your lambda!'),
  endUserUploadRole: getRequiredEnv('UPLOAD_ROLE', 'UPLOAD_ROLE is not set in your lambda!'),
  uploadPresignedCommandExpirySeconds: Number(getRequiredEnv('UPLOAD_FILES_TIMEOUT_MINUTES', '60')) * 60,
  downloadPresignedCommandExpirySeconds: 15 * 60,
  awsPartition: getRequiredEnv('AWS_PARTITION', 'AWS_PARTITION is not set in your lambda!'),
  checksumQueueUrl: getRequiredEnv('CHECKSUM_QUEUE_URL', 'CHECKSUM_QUEUE_URL is not set in your lambda!'),
};

export const createCaseFileUpload = async (
  caseFile: Readonly<DeaCaseFile>,
  datasetsProvider: Readonly<DatasetsProvider>
): Promise<string> => {
  const s3Key = getS3KeyForCaseFile(caseFile);
  logger.info('Initiating multipart upload.', { s3Key });
  let response;
  try {
    response = await datasetsProvider.s3Client.send(
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
  } catch (error) {
    logger.error(`received ${JSON.stringify(error)}`);
    throw error;
  }

  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload.');
  }

  logger.info('Multipart started');

  return response.UploadId;
};

export const getTemporaryCredentialsForUpload = async (
  caseFile: Readonly<DeaCaseFile>,
  uploadId: string,
  userUlid: string,
  sourceIp: string,
  datasetsProvider: Readonly<DatasetsProvider>
): Promise<DeaCaseFileUpload> => {
  const s3Key = getS3KeyForCaseFile(caseFile);
  const input: AssumeRoleCommandInput = {
    RoleSessionName: `USER_${userUlid}`,
    RoleArn: datasetsProvider.endUserUploadRole,
    Policy: getPolicyForUpload(s3Key, sourceIp, datasetsProvider),
    DurationSeconds: datasetsProvider.uploadPresignedCommandExpirySeconds,
  };
  const command = new AssumeRoleCommand(input);
  const federationTokenResponse = await stsClient.send(command);
  if (
    !federationTokenResponse.Credentials ||
    !federationTokenResponse.Credentials.AccessKeyId ||
    !federationTokenResponse.Credentials.SecretAccessKey ||
    !federationTokenResponse.Credentials.SessionToken
  ) {
    await datasetsProvider.s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: datasetsProvider.bucketName,
        Key: s3Key,
        UploadId: uploadId,
      })
    );

    throw new Error('Failed to generate upload credentials');
  }

  return {
    ...caseFile,
    bucket: datasetsProvider.bucketName,
    region,
    uploadId,
    federationCredentials: {
      accessKeyId: federationTokenResponse.Credentials.AccessKeyId,
      secretAccessKey: federationTokenResponse.Credentials.SecretAccessKey,
      sessionToken: federationTokenResponse.Credentials.SessionToken,
    },
  };
};

export const completeUploadForCaseFile = async (
  caseFile: CompleteCaseFileUploadObject,
  datasetsProvider: DatasetsProvider
): Promise<string | undefined> => {
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
          return { ETag: part.ETag, PartNumber: part.PartNumber, ChecksumSHA256: part.ChecksumSHA256 };
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

  return handleUploadChecksum(
    uploadedParts,
    caseFile,
    s3Key,
    datasetsProvider.bucketName,
    datasetsProvider.checksumQueueUrl
  );
};

const handleUploadChecksum = async (
  uploadedParts: Part[],
  caseFile: CompleteCaseFileUploadObject,
  s3Key: string,
  s3Bucket: string,
  queueUrl: string
) => {
  if (uploadedParts.length === 1) {
    return uploadedParts[0].ChecksumSHA256;
  }

  // Add messsage to sqs for checksum calculation
  const sqsEntries: SendMessageBatchRequestEntry[] = [];
  for (let currentPart = 1; currentPart <= uploadedParts.length; ++currentPart) {
    const messageBody: MultipartChecksumBody = {
      caseUlid: caseFile.caseUlid,
      caseFileUlid: caseFile.ulid,
      s3Key,
      s3Bucket,
      currentPart,
      totalParts: uploadedParts.length,
    };

    const entryId = ulid();
    sqsEntries.push({
      Id: entryId,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: `${caseFile.caseUlid}#${caseFile.ulid}#`,
      MessageDeduplicationId: entryId,
    });

    if (sqsEntries.length === SQS_BATCH_LIMIT) {
      const sendMessageCommand = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: sqsEntries,
      });
      await sqsClient.send(sendMessageCommand);
      sqsEntries.length = 0;
    }
  }

  if (sqsEntries.length > 0) {
    const sendMessageCommand = new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: sqsEntries,
    });
    await sqsClient.send(sendMessageCommand);
  }

  return undefined;
};

export const getPresignedUrlForDownload = async (
  caseFile: DeaCaseFile,
  sourceIp: string,
  datasetsProvider: DatasetsProvider,
  downloadReason = '',
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
  const roleSessionName = `${caseFile.caseUlid}-${caseFile.ulid}`;
  const presignedUrlS3Client = await getDownloadPresignedUrlClient(
    s3Key,
    sourceIp,
    roleSessionName,
    datasetsProvider
  );
  const getObjectCommand = new GetObjectCommand({
    Bucket: datasetsProvider.bucketName,
    Key: s3Key,
    VersionId: caseFile.versionId,
    ResponseContentType: caseFile.contentType,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(caseFile.fileName)}`,
  });

  result.downloadUrl = await getSignedUrl(presignedUrlS3Client, getObjectCommand, {
    expiresIn: datasetsProvider.downloadPresignedCommandExpirySeconds,
  });
  result.downloadReason = downloadReason;
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
  const s3ControlClient = new S3ControlClient({ region, customUserAgent: getCustomUserAgent() });
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
  const input: CreateJobCommandInput = {
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
      Bucket: `arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}`,
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
        ObjectArn: `arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${manifestFileName}`,
        ETag: manifestFileEtag,
      },
    },
  };
  logger.debug('CreateJobCommand Input', input);

  const s3ControlClient = new S3ControlClient({ region, customUserAgent: getCustomUserAgent() });
  const result = await s3ControlClient.send(new CreateJobCommand(input));
  if (!result.JobId) {
    throw new Error('Failed to create delete files batch job.');
  }
  return result.JobId;
};

function getS3KeyForCaseFile(caseFile: DeaCaseFile | CompleteCaseFileUploadObject): string {
  return caseFile.fileS3Key;
}

async function getDownloadPresignedUrlClient(
  objectKey: string,
  sourceIp: string,
  roleSessionName: string,
  datasetsProvider: DatasetsProvider
): Promise<S3Client> {
  const credentials = (
    await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: datasetsProvider.datasetsRole,
        RoleSessionName: roleSessionName,
        DurationSeconds: datasetsProvider.downloadPresignedCommandExpirySeconds,
        Policy: getPolicyForDownload(objectKey, sourceIp, datasetsProvider),
      })
    )
  ).Credentials;

  if (!credentials || !credentials.SecretAccessKey || !credentials.AccessKeyId) {
    logger.error('Failed to assume datasets role', { datasetsRole: datasetsProvider.datasetsRole });
    throw new Error('Failed to assume role');
  }

  return new S3Client({
    region,
    customUserAgent: getCustomUserAgent(),
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration,
    },
  });
}

function getPolicyForUpload(objectKey: string, sourceIp: string, datasetsProvider: DatasetsProvider): string {
  if (!datasetsProvider.sourceIpValidationEnabled) {
    logger.info('Not restricting presigned-url by source ip');
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3PutObject',
          Effect: 'Allow',
          Action: ['s3:PutObject'],
          Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        },
        restrictAccountStatement,
      ],
    });
  }
  logger.info('Restricting presigned-url by source ip', { sourceIp });

  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowS3PutObject',
        Effect: 'Allow',
        Action: ['s3:PutObject'],
        Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        Condition: {
          IpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      {
        Sid: 'DenyRequestsFromOtherIpAddresses',
        Effect: 'Deny',
        Action: ['s3:PutObject'],
        Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        Condition: {
          NotIpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      restrictAccountStatement,
    ],
  });
}

function getPolicyForDownload(
  objectKey: string,
  sourceIp: string,
  datasetsProvider: DatasetsProvider
): string {
  const keyArn = getRequiredEnv('KEY_ARN');
  if (!datasetsProvider.sourceIpValidationEnabled) {
    logger.info('Not restricting presigned-url by source ip');
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3GetObject',
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:GetObjectVersion'],
          Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        },
        {
          Sid: 'AllowDecrypt',
          Effect: 'Allow',
          Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
          Resource: [keyArn],
        },
      ],
    });
  }
  logger.info('Restricting presigned-url by source ip', { sourceIp });
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowS3GetObject',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:GetObjectVersion'],
        Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        Condition: {
          IpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      {
        Sid: 'DenyRequestsFromOtherIpAddresses',
        Effect: 'Deny',
        Action: ['s3:GetObject', 's3:GetObjectVersion'],
        Resource: [`arn:${datasetsProvider.awsPartition}:s3:::${datasetsProvider.bucketName}/${objectKey}`],
        Condition: {
          NotIpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      {
        Sid: 'AllowDecrypt',
        Effect: 'Allow',
        Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
        Resource: [keyArn],
      },
      {
        Sid: 'DenyKeyRequestsFromOtherIpAddresses',
        Effect: 'Deny',
        Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
        Resource: [keyArn],
        Condition: {
          NotIpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
    ],
  });
}
