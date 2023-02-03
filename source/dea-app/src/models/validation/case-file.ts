/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiUlid, fileName, filePath, fileType, sha256Hash, uploadId } from './joi-common';

export const initiateCaseFileUploadRequestSchema = Joi.object({
    caseUlid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    fileType: fileType,
    preceedingDirectoryUlid: joiUlid,
    fileSizeMb: Joi.number().greater(0).less(5_000_000), // 0-5TB is the range supported by S3
});

export const initiateCaseFileUploadResponseSchema = Joi.object({
    caseUlid: joiUlid,
    uploadId: uploadId,
    ulid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    fileType: fileType,
    preceedingDirectoryUlid: joiUlid,
    fileSizeMb: Joi.number().greater(0).less(5_000_000), // 0-5TB is the range supported by S3
    preSignedUrls: Joi.array().items(Joi.string().uri()),
});

export const completeCaseFileUploadRequestSchema = Joi.object({
    caseUlid: joiUlid,
    uploadId: uploadId,
    ulid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    preceedingDirectoryUlid: joiUlid,
    sha256Hash: sha256Hash
});

export const completeCaseFileUploadResponseSchema = Joi.object({
    caseUlid: joiUlid,
    uploadId: uploadId,
    ulid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    preceedingDirectoryUlid: joiUlid,
    sha256Hash: sha256Hash
});