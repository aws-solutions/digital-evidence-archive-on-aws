/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseAction } from '../case-action';
import { joiUlid, safeName } from './joi-common';

export const caseUserSchema = Joi.object({
  userUlid: joiUlid,
  caseUlid: joiUlid,
  actions: Joi.array()
    .items(Joi.string().valid(...Object.keys(CaseAction)))
    .required(),
});

export const caseUserResponseSchema = Joi.object({
  userFirstName: safeName,
  userLastName: safeName,
  caseName: safeName,
  userUlid: joiUlid,
  caseUlid: joiUlid,
  actions: Joi.array()
    .items(Joi.string().valid(...Object.keys(CaseAction)))
    .required(),
  created: Joi.date(),
  updated: Joi.date(),
});