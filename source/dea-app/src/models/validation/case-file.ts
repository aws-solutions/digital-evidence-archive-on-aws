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
  uploadId: Joi.string().optional(),
});

export const initiateCaseFileUploadResponseSchema = Joi.object({
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
  federationCredentials: Joi.object({
    accessKeyId: Joi.string(),
    secretAccessKey: Joi.string(),
    sessionToken: Joi.string(),
  }),
  sha256Hash: Joi.string(),
  status: caseFileStatus,
  reason: safeReason,
  details: safeDetails,
  created: Joi.date(),
  updated: Joi.date(),
  fileS3Key: s3Identifier,
  bucket: Joi.string(),
  region: Joi.string(),
});

export const completeCaseFileUploadRequestSchema = Joi.object({
  caseUlid: joiUlid,
  ulid: joiUlid,
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
  sha256Hash: Joi.string(),
  status: caseFileStatus,
  reason: safeReason,
  details: safeDetails,
  created: Joi.date(),
  updated: Joi.date(),
  fileS3Key: s3Identifier,
});

export const caseAssociationRequestSchema = Joi.object({
  caseUlids: Joi.array().items(joiUlid).required(),
  fileUlids: Joi.array().items(joiUlid).required(),
});

export const removeCaseAssociationRequestSchema = Joi.object({
  caseUlids: Joi.array().items(joiUlid).required(),
});

export const downloadFileRequestBodySchema = Joi.object({
  caseUlid: joiUlid,
  ulid: joiUlid,
  downloadReason: safeReason,
});
