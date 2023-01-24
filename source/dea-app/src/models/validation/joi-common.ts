/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';

export const allButDisallowed = new RegExp('^[^\\<>/]+$');

export const joiUlid = Joi.string().pattern(new RegExp('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$'));
