/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { idToken, refreshToken } from './joi-common';

export const Oauth2TokenSchema = Joi.object({
  id_token: idToken.required(),
  refresh_token: refreshToken.required(),
  expires_in: Joi.number(),
});

export const ExchangeTokenSchema = Joi.object({
  codeVerifier: Joi.string(),
});
