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
} from './joi-common';

export const initiateCaseFileUploadRequestSchema = Joi.object({
  caseUlid: joiUlid,
  fileName: fileName,
  filePath: filePath,
  contentType: contentType,
  fileSizeMb: Joi.number().greater(0).less(5_000_000), // 0-5TB is the range supported by S3
});

export const completeCaseFileUploadRequestSchema = Joi.object({
  caseUlid: joiUlid,
  ulid: joiUlid,
  sha256Hash: sha256Hash,
});

export const downloadCaseFileResponseSchema = Joi.object({
  downloadUrl: Joi.string().uri(),
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
  fileSizeMb: Joi.number().greater(0).less(5_000_000), // 0-5TB is the range supported by S3
  ttl: Joi.number().greater(0),
  presignedUrls: Joi.array().items(Joi.string().uri()),
  sha256Hash: sha256Hash,
  status: caseFileStatus,
  created: Joi.date(),
  updated: Joi.date(),
});
