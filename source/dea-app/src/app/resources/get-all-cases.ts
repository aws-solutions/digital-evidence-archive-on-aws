/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { listAllCases } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getAllCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const paginationParams = getPaginationParameters(event);

  const pageOfCases = await listAllCases(
    paginationParams.limit,
    paginationParams.nextToken,
    repositoryProvider
  );

  return responseOk({
    cases: pageOfCases,
    total: pageOfCases.count,
    next: getNextToken(pageOfCases.next),
  });
};
