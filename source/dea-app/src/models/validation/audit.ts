/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { unixTimestamp } from './joi-common';

export const auditQuerySchema = Joi.object({
  from: unixTimestamp,
  to: unixTimestamp,
});
