/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { idToken, refreshToken } from './joi-common';

export const RefreshTokenSchema = Joi.object({
  refreshToken: refreshToken,
});

export const RevokeTokenSchema = Joi.object({
  refreshToken: refreshToken,
});

export const IdTokenSchema = Joi.object({
  idToken: idToken,
});
