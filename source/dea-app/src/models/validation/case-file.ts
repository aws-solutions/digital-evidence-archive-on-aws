/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { caseStatus, joiUlid, safeDescription, safeName, fileName, filePath, htmlSafeCharsRegex, sha256Hash } from './joi-common';

export const initiateCaseFileUploadSchema = Joi.object({
    caseUlid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    fileType: safeName,
    fileSizeMb: Joi.number().greater(0).less(5_000_000), // 0-5TB is the range supported by S3
});

export const completeCaseFileUploadSchema = Joi.object({
    caseUlid: joiUlid,
    uploadId: Joi.string().pattern(htmlSafeCharsRegex).required(),
    caseFileUlid: joiUlid,
    fileName: fileName,
    filePath: filePath,
    sha256Hash: sha256Hash
});
