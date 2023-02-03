/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getUserUlid } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { createCaseSchema } from '../../models/validation/case';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const createCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  if (!event.body) {
    throw new ValidationError('Create cases payload missing.');
  }

  const userUlid = getUserUlid(event);

  const deaCase: DeaCase = JSON.parse(event.body);
  Joi.assert(deaCase, createCaseSchema);

  const updateBody = await CaseService.createCases(deaCase, userUlid, repositoryProvider);

  return {
    statusCode: 200,
    body: JSON.stringify(updateBody),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
