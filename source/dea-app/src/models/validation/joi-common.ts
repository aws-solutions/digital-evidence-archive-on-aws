/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';

export const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const filenameSafeCharsRegex = new RegExp('^[^<>:"\\/|?*]+$');

// using unix convention. will have to see what we need to do to be unix and windows compatible
export const filePathSafeCharsRegex = new RegExp('^[^<>:"\\|?*]*/$');

export const htmlSafeCharsRegex = new RegExp('^[^&"\'<>]*$');

export const uploadId = Joi.string().pattern(htmlSafeCharsRegex).required();

export const joiUlid = Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$'));

export const sha256Hash = Joi.string().pattern(new RegExp('^[a-fA-F0-9]{64}$')).required();

export const safeName = Joi.string().pattern(allButDisallowed).required().min(3).max(30);

export const fileName = Joi.string().pattern(filenameSafeCharsRegex).required().max(255).required();

export const filePath = Joi.string().pattern(filePathSafeCharsRegex).required().min(1).required();

export const fileType = Joi.string().pattern(htmlSafeCharsRegex);

export const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));

export const safeDescription = Joi.string().pattern(allButDisallowed).max(200).min(3).optional();
