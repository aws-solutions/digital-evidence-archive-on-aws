/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { caseFileStatus, caseStatus, joiUlid, safeDescription, safeName } from './joi-common';

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
  filesStatus: caseFileStatus,
  created: Joi.date(),
  updated: Joi.date(),
});

export const updateCaseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  description: safeDescription,
});

export const updateCaseStatusSchema = Joi.object({
  name: safeName,
  status: caseStatus,
  deleteFiles: Joi.bool().optional().default(false),
});
