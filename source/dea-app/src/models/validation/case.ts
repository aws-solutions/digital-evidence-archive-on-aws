/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseStatus } from '../case-status';
import { allButDisallowed, joiUlid } from './joi-common';

const safeName = Joi.string().pattern(allButDisallowed).required().min(3).max(30);
const caseStatus = Joi.string().valid(...Object.keys(CaseStatus));
const safeDescription = Joi.string().pattern(allButDisallowed).max(200).min(3).optional();

export const createCaseSchema = Joi.object({
  name: safeName,
  status: caseStatus,
  description: safeDescription,
});

export const caseResponseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  status: caseStatus,
  description: safeDescription,
  objectCount: Joi.number(),
  created: Joi.date(),
  updated: Joi.date(),
});

export const updateCaseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  description: safeDescription,
});
