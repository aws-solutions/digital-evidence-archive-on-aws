/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiUlid, jti, ttlJoi } from './joi-common';

export const sessionResponseSchema = Joi.object({
  userUlid: joiUlid,
  ttl: ttlJoi,
  isRevoked: Joi.boolean(),
  created: Joi.date(),
  updated: Joi.date(),
  tokenId: jti,
});
