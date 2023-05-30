/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import {
  joiUlid,
  fileName,
  filePath,
  contentType,
  sha256Hash,
  s3Identifier,
  caseFileStatus,
  safeReason,
  safeDetails,
  safeFileSize,
  safeChunkSize,
} from './joi-common';

export const initiateCaseFileUploadRequestSchema = Joi.object({
  caseUlid: joiUlid,
  fileName: fileName,
  filePath: filePath,
  contentType: contentType,
  chunkSizeBytes: safeChunkSize,
  fileSizeBytes: safeFileSize,
  reason: safeReason,
  details: safeDetails,
});

export const completeCaseFileUploadRequestSchema = Joi.object({
  caseUlid: joiUlid,
  ulid: joiUlid,
  sha256Hash: sha256Hash,
  uploadId: s3Identifier,
});

export const caseFileResponseSchema = Joi.object({
  caseUlid: joiUlid,
  uploadId: s3Identifier,
  versionId: s3Identifier,
  ulid: joiUlid,
  fileName: fileName,
  filePath: filePath,
  contentType: contentType,
  createdBy: joiUlid,
  isFile: Joi.boolean(),
  chunkSizeBytes: safeChunkSize,
  fileSizeBytes: safeFileSize,
  ttl: Joi.number().greater(0),
  presignedUrls: Joi.array().items(Joi.string().uri()),
  sha256Hash: sha256Hash,
  status: caseFileStatus,
  reason: safeReason,
  details: safeDetails,
  created: Joi.date(),
  updated: Joi.date(),
});
