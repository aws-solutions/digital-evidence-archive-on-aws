/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';

const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const caseSchema = Joi.object({
  ulid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')),
  name: Joi.string().pattern(allButDisallowed).required().min(3).max(30),
  status: Joi.string().valid(...Object.keys(CaseStatus)),
  description: Joi.string().pattern(allButDisallowed).max(200).min(3).required(),
  objectCount: Joi.number(),
});

export const caseResponseSchema = Joi.object({
  ulid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')),
  name: Joi.string().pattern(allButDisallowed).required().min(3).max(30),
  status: Joi.string().valid(...Object.keys(CaseStatus)),
  description: Joi.string().pattern(allButDisallowed).max(200).min(3).required(),
  objectCount: Joi.number(),
  created: Joi.date(),
  updated: Joi.date(),
});

export const updateCaseSchema = Joi.object({
  ulid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')),
  name: Joi.string().pattern(allButDisallowed).required().min(3).max(30),
  status: Joi.string().valid(...Object.keys(CaseStatus)),
  description: Joi.string().pattern(allButDisallowed).max(200).min(3).required(),
  objectCount: null, // currently, do not allow objectcount in update case. Object count will be addressed in upload file
});
