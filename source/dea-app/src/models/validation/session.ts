/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiUlid, ttlJoi } from './joi-common';

export const sessionResponseSchema = Joi.object({
  userUlid: joiUlid,
  // TODO TokenId
  ttl: ttlJoi,
  isRevoked: Joi.boolean(),
  created: Joi.date(),
  updated: Joi.date(),
});
