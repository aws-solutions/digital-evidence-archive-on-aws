/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { listDataVaultTasks } from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getDataVaultTasks: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const paginationParams = getPaginationParameters(event);

  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  const pageOfDataVaultTasks = await listDataVaultTasks(
    repositoryProvider,
    dataVaultId,
    paginationParams.nextToken,
    paginationParams.limit
  );

  return responseOk(event, {
    dataVaultTasks: pageOfDataVaultTasks,
    total: pageOfDataVaultTasks.count,
    next: getNextToken(pageOfDataVaultTasks.next),
  });
};
