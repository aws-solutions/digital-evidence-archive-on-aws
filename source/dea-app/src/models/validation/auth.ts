/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { refreshToken } from './joi-common';

export const RevokeTokenSchema = Joi.object({
  refreshToken: refreshToken,
});
