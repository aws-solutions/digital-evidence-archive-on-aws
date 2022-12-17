/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { CaseAction } from '../case-action';

export const caseUserSchema = Joi.object({
  userUlid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')).required(),
  caseUlid: Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$')).required(),
  actions: Joi.array()
    .items(Joi.string().valid(...Object.keys(CaseAction)))
    .required(),
});
