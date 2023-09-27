/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { taskIdJoi } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { listDataVaultExecutions } from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getDataVaultExecutions: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const paginationParams = getPaginationParameters(event);

  const taskId = getRequiredPathParam(event, 'taskId', taskIdJoi);

  const pageOfDataVaultExecutions = await listDataVaultExecutions(
    repositoryProvider,
    taskId,
    paginationParams.nextToken,
    paginationParams.limit
  );

  return responseOk(event, {
    dataVaultExecutions: pageOfDataVaultExecutions,
    total: pageOfDataVaultExecutions.count,
    next: getNextToken(pageOfDataVaultExecutions.next),
  });
};
