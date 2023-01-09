/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { caseSchema } from '../../models/validation/case';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const createCases: DEAGatewayProxyHandler = async (event, context) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  if (!event.body) {
    throw new ValidationError('Create cases payload missing.');
  }

  const deaCase: DeaCase = JSON.parse(event.body);
  Joi.assert(deaCase, caseSchema);

  const updateBody = await CaseService.createCases(deaCase);

  return {
    statusCode: 200,
    body: JSON.stringify(updateBody),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
