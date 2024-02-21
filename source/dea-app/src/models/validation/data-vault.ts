/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiArn, joiUlid, safeDescription, safeName } from './joi-common';

export const createDataVaultSchema = Joi.object({
  name: safeName,
  description: safeDescription,
});

export const updateDataVaultSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  description: safeDescription,
});

export const dataVaultResponseSchema = Joi.object({
  ulid: joiUlid,
  name: safeName,
  description: safeDescription,
  objectCount: Joi.number(),
  totalSizeBytes: Joi.number(),
  created: Joi.date(),
  updated: Joi.date(),
});

export const createDataVaultTaskSchema = Joi.object({
  name: safeName,
  description: safeDescription,
  sourceLocationArn: joiArn.required(),
  destinationFolder: Joi.string().optional(),
});

export const dataVaultTaskResponseSchema = Joi.object({
  taskId: Joi.string(),
  dataVaultUlid: Joi.string(),
  name: safeName,
  description: safeDescription,
  sourceLocationArn: Joi.string(),
  destinationLocationArn: Joi.string(),
  taskArn: Joi.string(),
  created: Joi.date(),
  updated: Joi.date(),
  deleted: Joi.boolean(),
});

export const createDataVaultExecutionSchema = Joi.object({
  taskArn: joiArn.required(),
});

export const dataVaultExecutionResponseSchema = Joi.object({
  taskId: Joi.string(),
  executionId: Joi.string(),
  createdBy: Joi.string(),
  created: Joi.date(),
});

export const dataSyncTaskSchema = Joi.object({
  taskArn: Joi.string(),
  taskId: Joi.string(),
  sourceLocationArn: Joi.string(),
  destinationLocationArn: Joi.string(),
  dataVaultUlid: Joi.string().empty(''),
  status: Joi.string(),
  created: Joi.date(),
  lastExecutionCompleted: Joi.date(),
});
