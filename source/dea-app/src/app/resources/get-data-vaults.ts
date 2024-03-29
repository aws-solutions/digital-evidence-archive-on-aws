/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters } from '../../lambda-http-helpers';
import { listDataVaults } from '../../persistence/data-vault';
import { defaultProvider } from '../../persistence/schema/entities';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getDataVaults: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const paginationParams = getPaginationParameters(event);

  const pageOfDataVaults = await listDataVaults(
    repositoryProvider,
    paginationParams.nextToken,
    paginationParams.limit
  );

  return responseOk(event, {
    dataVaults: pageOfDataVaults,
    total: pageOfDataVaults.count,
    next: getNextToken(pageOfDataVaults.next),
  });
};
