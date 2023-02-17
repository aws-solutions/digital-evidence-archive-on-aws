/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { defaultProvider } from '../../persistence/schema/entities';
import { deleteCaseUser } from '../services/case-user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const deleteCaseMembership: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const caseId = getRequiredPathParam(event, 'caseId');
  const userId = getRequiredPathParam(event, 'userId');

  const caseUserResult = await deleteCaseUser(userId, caseId, repositoryProvider);
  return {
    statusCode: 204,
    body: JSON.stringify(caseUserResult),
  };
};
