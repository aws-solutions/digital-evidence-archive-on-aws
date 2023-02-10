/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiUlid, safeName } from './joi-common';

export const userResponseSchema = Joi.object({
  ulid: joiUlid,
  firstName: safeName,
  lastName: safeName,
  created: Joi.date(),
  updated: Joi.date(),
});
