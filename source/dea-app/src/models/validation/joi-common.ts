/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';

export const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const joiUlid = Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$'));

export const safeName = Joi.string().pattern(allButDisallowed).required().min(3).max(30);

export const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));

export const safeDescription = Joi.string().pattern(allButDisallowed).max(200).min(3).optional();
