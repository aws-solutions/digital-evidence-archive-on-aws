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
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { DeaCaseFile } from '../../models/case-file';
import * as CaseFilePersistence from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';

const region = process.env.AWS_REGION ?? 'us-east-1';
const s3Client = new S3Client({ region });
const bucketName = getRequiredEnv('DATASETS_BUCKET_NAME', 'DATASETS_BUCKET_NAME is not set in your lambda!');

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
  // need to see who is initiating upload. add that info to s3 and ddb
  // check if file already exists
  // need to add a status to indicate if file has been uploaded or is pending
  // need to add a ttl to clear out incomplete case-files
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    deaCaseFile,
    repositoryProvider
  );

  const s3Key = _getS3KeyForCaseFile(caseFile);

  // define constants
  const response = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: s3Key,
      BucketKeyEnabled: true,
      ServerSideEncryption: 'aws:kms',
      //ChecksumAlgorithm: 'SHA256'
      ContentType: caseFile.contentType,
      ObjectLockLegalHoldStatus: 'ON',
      StorageClass: 'INTELLIGENT_TIERING',
    })
  );

  const uploadId = response.UploadId as string;

  // using 500MB chunks so we can support a max file size of 5TB with a max of 10,000 chunks
  // limits obtained from link below on 2/7/2023
  // https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
  const fileParts = Math.ceil(deaCaseFile.fileSizeMb / 500); // fixme: chunk size should be a variable for testing purposes
  const presignedUrlPromises = [];
  for (let i = 0; i < fileParts; i++) {
    presignedUrlPromises[i] = _getPresignedUrlPromise(bucketName, s3Key, uploadId, i + 1);
  }
  await Promise.all(presignedUrlPromises).then((presignedUrls) => {
    caseFile.presignedUrls = presignedUrls;
  });

  // update ddb with upload-id
  caseFile.uploadId = uploadId;

  return caseFile;
};

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
  // todo: check if case-file exists and that it is actually pending

  let uploadedParts: Part[] = [];
  let listPartsResponse: ListPartsOutput;
  let partNumberMarker;
  /* eslint-disable no-await-in-loop */
  do {
    listPartsResponse = await s3Client.send(
      new ListPartsCommand({
        Bucket: bucketName,
        Key: _getS3KeyForCaseFile(deaCaseFile),
        PartNumberMarker: partNumberMarker,
        UploadId: deaCaseFile.uploadId,
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

  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: _getS3KeyForCaseFile(deaCaseFile),
      //ChecksumSHA256: deaCaseFile.sha256Hash,
      UploadId: deaCaseFile.uploadId,
      MultipartUpload: { Parts: uploadedParts },
    })
  );

  // update status and remove ttl
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};

function _getS3KeyForCaseFile(caseFile: DeaCaseFile): string {
  return `${caseFile.caseUlid}/${caseFile.ulid}`;
}

async function _getPresignedUrlPromise(
  bucket: string,
  s3Key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const uploadPartCommand = new UploadPartCommand({
    Bucket: bucket,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3Client, uploadPartCommand, { expiresIn: 3600 });
}
