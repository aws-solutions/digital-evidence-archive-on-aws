/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';

export const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const filenameSafeCharsRegex = new RegExp('^[^/\\0]+$');

// using unix convention. will have to see what we need to do to be unix and windows compatible
// allow '/' for root directory, enforce path starts and ends with '/' for anything else
export const filePathSafeCharsRegex = new RegExp('^(/[^<>:"\\|?*]+/|/)$');

export const htmlSafeCharsRegex = new RegExp('^[^&"\'<>]*$');

export const ulidRegex = new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$');

export const uploadId = Joi.string().pattern(htmlSafeCharsRegex);

export const joiUlid = Joi.string().pattern(ulidRegex);

export const sha256Hash = Joi.string().pattern(new RegExp('^[a-fA-F0-9]{64}$'));

export const safeName = Joi.string().pattern(allButDisallowed).required().min(3).max(50);

export const fileName = Joi.string().pattern(filenameSafeCharsRegex).required().max(255).required();

export const filePath = Joi.string().pattern(filePathSafeCharsRegex).required().min(1).required();

export const contentType = Joi.string().pattern(htmlSafeCharsRegex);

export const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));

export const idToken = Joi.string().regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/);

export const safeDescription = Joi.string().pattern(allButDisallowed).max(200).min(3).optional();
