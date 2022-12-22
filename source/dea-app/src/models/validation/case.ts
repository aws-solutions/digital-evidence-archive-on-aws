/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';

export const caseSchema = Joi.object({
  ulid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')),
  name: Joi.string().pattern(new RegExp('^[a-zA-Z0-9 ]{3,30}$')).required(),
  status: Joi.string().valid(...Object.keys(CaseStatus)),
  description: Joi.string().pattern(new RegExp('^[a-zA-Z0-9 ]{1,200}$')).required(),
  objectCount: Joi.number(),
});

export const updateCaseSchema = Joi.object({
  ulid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')),
  name: Joi.string().pattern(new RegExp('^[a-zA-Z0-9 ]{3,30}$')),
  status: Joi.string().valid(...Object.keys(CaseStatus)),
  description: Joi.string().pattern(new RegExp('^[a-zA-Z0-9 ]{1,200}$')),
  objectCount: null, // currently, do not allow objectcount in update case. Object count will be addressed in upload file
});
