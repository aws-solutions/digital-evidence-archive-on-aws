/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseAction } from '../case-action';
import { caseFileStatus, caseStatus, joiUlid, s3Identifier, safeDescription, safeName } from './joi-common';

export const createCaseSchema = Joi.object({
  name: safeName,
  status: caseStatus,
  description: safeDescription,
});

export const scopedCaseResponseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
});

export const caseResponseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  status: caseStatus,
  description: safeDescription,
  objectCount: Joi.number(),
  actions: Joi.array()
    .items(Joi.string().valid(...Object.keys(CaseAction)))
    .optional(),
  totalSizeBytes: Joi.number(),
  filesStatus: caseFileStatus,
  s3BatchJobId: s3Identifier,
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
