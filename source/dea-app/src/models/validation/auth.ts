/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { idToken, refreshToken } from './joi-common';

export const Oauth2TokenSchema = Joi.object({
  id_token: idToken,
  refresh_token: refreshToken,
  expires_in: Joi.number(),
  token_type: Joi.string(),
});

export const ExchangeTokenSchema = Joi.object({
  codeVerifier: Joi.string(),
});
