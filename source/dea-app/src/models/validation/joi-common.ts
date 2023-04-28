/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseFileStatus } from '../case-file-status';
import { CaseStatus } from '../case-status';

export const ONE_MB = 1024 * 1024;
export const ONE_TB = 1024 * 1024 * 1024 * 1024;

export const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const filenameSafeCharsRegex = new RegExp('^[^/\\0]+$');

// using unix convention. will have to see what we need to do to be unix and windows compatible
// allow '/' for root directory, enforce path starts and ends with '/' for anything else
export const filePathSafeCharsRegex = new RegExp('^(/[^<>:"\\|?*]+/|/)$');

export const htmlSafeCharsRegex = new RegExp('^[^&"\'<>]*$');

export const ulidRegex = new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$');

export const jtiRegex = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

export const s3Identifier = Joi.string().pattern(htmlSafeCharsRegex);

export const joiUlid = Joi.string().pattern(ulidRegex);

export const joiUuid = Joi.string().uuid();

export const sha256Hash = Joi.string().pattern(new RegExp('^[a-fA-F0-9]{64}$'));

export const safeName = Joi.string().pattern(allButDisallowed).required().min(3).max(50);

export const safeTag = Joi.string().pattern(allButDisallowed).min(2).max(200);
export const safeReason = Joi.string().pattern(allButDisallowed).min(2).max(250);
export const safeDetails = Joi.string().pattern(allButDisallowed).min(2).max(250);

export const fileName = Joi.string().pattern(filenameSafeCharsRegex).required().max(255).required();

export const filePath = Joi.string().pattern(filePathSafeCharsRegex).required().min(1).required();

export const contentType = Joi.string().pattern(htmlSafeCharsRegex);

export const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));

export const idToken = Joi.string().regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/);

export const refreshToken = Joi.string().regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/);

export const loginUrlRegex = Joi.string().uri();

export const caseFileStatus = Joi.string().valid(...Object.keys(CaseFileStatus));

export const safeDescription = Joi.string().pattern(allButDisallowed).max(200).min(3).optional();

export const paginationLimit = Joi.number().min(1).max(100).optional();

export const base64String = Joi.string().base64().required();

export const ttlJoi = Joi.number().min(1500000000).max(5000000000).required();

export const jti = Joi.string().pattern(jtiRegex).required();

// https://github.com/odomojuli/RegExAPI
export const authCode = Joi.string().regex(/^[A-Za-z0-9-_]+$/);

export const safeFileSize = Joi.number()
  .greater(0)
  .less(5 * ONE_TB); // 0-5TB is the range supported by S3

export const safeChunkSize = Joi.number()
  .greater(5 * ONE_MB)
  .less(500 * ONE_MB); // 5MB is minimum size supported by S3, 500MB is the max necessary to upload a 5TB file
