/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseFileStatus } from '../case-file-status';
import { CaseStatus } from '../case-status';

export const ONE_MB = 1024 * 1024;
export const ONE_TB = 1024 * 1024 * 1024 * 1024;

function customJoiMessages(customMessage: string) {
  return {
    'string.pattern.base': customMessage,
    'string.pattern.name': customMessage,
    'string.pattern.invert.base': customMessage,
    'string.pattern.invert.name': customMessage,
  };
}

export const allButDisallowed = new RegExp('^[^\\<>/]+$');
const allButDisallowedMessage = 'The following characters are not allowed in {{#label}}: \\ < > /';

export const filenameSafeCharsRegex = new RegExp('^[^/\\0]+$');
const filenameSafeCharsMessage = 'Forward slash and null characters are not allowed in {{#label}}';

// using unix convention. will have to see what we need to do to be unix and windows compatible
// allow '/' for root directory, enforce path starts and ends with '/' for anything else
export const filePathSafeCharsRegex = new RegExp('^(/[^<>:"\\|?*]+/|/)$');
const filePathSafeCharsMessage = 'The following characters are not allowed in {{#label}}: < > : " ? *';

export const htmlSafeCharsRegex = new RegExp('^[^&"\'<>]*$');
const htmlSafeMessage = 'The following characters are not allowed in {{#label}}: & " \' < >';

export const ulidRegex = new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$');
const ulidMessage = '{{#label}} is not a valid ULID';

const arnMessage = '{{#label}} is not a valid ARN';

export const taskIdRegex = new RegExp('^task-[0-9a-z]{17}$');

export const taskReportRegex = new RegExp(
  'Detailed-Reports/task-[^/]+/exec-[^/]+/exec-[^/]+.files-verified-[^/]+'
);

export const jtiRegex = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

export const s3Identifier = Joi.string()
  .pattern(htmlSafeCharsRegex)
  .messages(customJoiMessages(htmlSafeMessage));

export const joiUlid = Joi.string().pattern(ulidRegex).messages(customJoiMessages(ulidMessage));

export const joiUuid = Joi.string().uuid();

export const joiArn = Joi.string()
  .pattern(new RegExp('.*\\S.*'))
  .min(20)
  .max(2048)
  .messages(customJoiMessages(arnMessage));

export const safeName = Joi.string()
  .pattern(allButDisallowed)
  .required()
  .min(3)
  .max(50)
  .messages(customJoiMessages(allButDisallowedMessage));

export const safeReason = Joi.string()
  .pattern(allButDisallowed)
  .min(2)
  .max(250)
  .messages(customJoiMessages(allButDisallowedMessage));
export const safeDetails = Joi.string()
  .pattern(allButDisallowed)
  .min(2)
  .max(250)
  .messages(customJoiMessages(allButDisallowedMessage));

export const fileName = Joi.string()
  .pattern(filenameSafeCharsRegex)
  .required()
  .max(255)
  .required()
  .messages(customJoiMessages(filenameSafeCharsMessage));

export const filePath = Joi.string()
  .pattern(filePathSafeCharsRegex)
  .required()
  .min(1)
  .max(500)
  .required()
  .messages(customJoiMessages(filePathSafeCharsMessage));

export const contentType = Joi.string()
  .pattern(htmlSafeCharsRegex)
  .max(200)
  .messages(customJoiMessages(htmlSafeMessage));

export const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));

export const idToken = Joi.string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/)
  .messages(customJoiMessages('Invalid ID Token'));

export const refreshToken = Joi.string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/)
  .messages(customJoiMessages('Invalid refresh token'));

export const loginUrlRegex = Joi.string().uri();

export const caseFileStatus = Joi.string().valid(...Object.keys(CaseFileStatus));

export const safeDescription = Joi.string()
  .pattern(allButDisallowed)
  .max(200)
  .min(3)
  .optional()
  .messages(customJoiMessages(allButDisallowedMessage));

export const paginationLimit = Joi.number().min(1).max(10000).optional();

export const base64String = Joi.string().base64().required();

export const ttlJoi = Joi.number().min(1500000000).max(5000000000).required();

export const jti = Joi.string().pattern(jtiRegex).required().messages(customJoiMessages('Invalid JWT Id'));

export const taskIdJoi = Joi.string().pattern(taskIdRegex).required();

export const taskReportJoi = Joi.string().pattern(taskReportRegex).required();

// https://github.com/odomojuli/RegExAPI
export const authCode = Joi.string()
  .regex(/^[A-Za-z0-9-_]+$/)
  .messages(customJoiMessages('Invalid Auth code'));

// FileSize should be a positive integer less than 5 TB
export const safeFileSize = Joi.number()
  .integer()
  .positive()
  .less(5 * ONE_TB); // 0-5TB is the range supported by S3

// ChunkSize should be a positive integer in the expected range
export const safeChunkSize = Joi.number()
  .integer()
  .positive()
  .greater(5 * ONE_MB)
  .less(500 * ONE_MB); // 5MB is minimum size supported by S3, 500MB is the max necessary to upload a 5TB file

export const unixTimestamp = Joi.date()
  .timestamp('unix')
  .required()
  .messages(customJoiMessages('Invalid unix timestamp'));
