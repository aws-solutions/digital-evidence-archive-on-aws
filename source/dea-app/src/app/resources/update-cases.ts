/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { updateCaseSchema } from '../../models/validation/case';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const updateCases: DEAGatewayProxyHandler = async (event, context) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const caseId = getRequiredPathParam(event, 'caseId');

  if (!event.body) {
    throw new ValidationError('Update cases payload missing.');
  }

  const deaCase: DeaCase = JSON.parse(event.body);
  Joi.assert(deaCase, updateCaseSchema);

  const caseUpdateResult = await CaseService.updateCases(deaCase, caseId);
  return {
    statusCode: 200,
    body: JSON.stringify(caseUpdateResult),
  };
};
