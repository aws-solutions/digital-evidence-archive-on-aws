/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getCase: DEAGatewayProxyHandler = async (
  event,
  context,
  repositoryProvider = defaultProvider,
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const caseId = getRequiredPathParam(event, 'caseId');

  const retreivedCase = await CaseService.getCase(caseId, repositoryProvider);
  if (!retreivedCase) {
    throw new NotFoundError(`Case with ulid ${caseId} not found.`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(retreivedCase),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
