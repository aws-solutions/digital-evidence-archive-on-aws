/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const deleteCase: DEAGatewayProxyHandler = async (event, context) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const caseId = getRequiredPathParam(event, 'caseId');

  await CaseService.deleteCase(caseId);

  return {
    statusCode: 204,
  };
};
