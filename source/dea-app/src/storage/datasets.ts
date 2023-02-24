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
  ObjectLockLegalHoldStatus,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getRequiredEnv } from '../lambda-http-helpers';
import { logger } from '../logger';
import { DeaCaseFile } from '../models/case-file';

const region = process.env.AWS_REGION;

export interface DatasetsProvider {
  s3Client: S3Client;
  bucketName: string;
  chunkSizeMB: number;
  presignedCommandExpirySeconds: number;
}

export const defaultDatasetsProvider = {
  s3Client: new S3Client({ region }),
  bucketName: getRequiredEnv('DATASETS_BUCKET_NAME', 'DATASETS_BUCKET_NAME is not set in your lambda!'),
  chunkSizeMB: 500,
  presignedCommandExpirySeconds: 3600,
};

export const generatePresignedUrlsForCaseFile = async (
  caseFile: DeaCaseFile,
  datasetsProvider: DatasetsProvider
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

  // using 500MB chunks so we can support a max file size of 5TB with a max of 10,000 chunks
  // limits obtained from link below on 2/7/2023
  // https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
  const fileParts = Math.ceil(caseFile.fileSizeMb / datasetsProvider.chunkSizeMB);

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
  });
  return getSignedUrl(datasetsProvider.s3Client, getObjectCommand, {
    expiresIn: datasetsProvider.presignedCommandExpirySeconds,
  });
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
