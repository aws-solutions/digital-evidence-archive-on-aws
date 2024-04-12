/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters, getUserUlid } from '../../lambda-http-helpers';
import { listCasesForUser } from '../services/case-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getMyCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const paginationParams = getPaginationParameters(event);
  const userUlid = getUserUlid(event);

  const pageOfCases = await listCasesForUser(
    userUlid,
    providers.repositoryProvider,
    paginationParams.nextToken,
    paginationParams.limit
  );

  return responseOk(event, {
    cases: pageOfCases,
    total: pageOfCases.count,
    next: getNextToken(pageOfCases.next),
  });
};
