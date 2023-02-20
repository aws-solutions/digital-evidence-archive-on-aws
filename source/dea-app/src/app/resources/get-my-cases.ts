/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getUserUlid } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { listCasesForUser } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { getNextToken } from './get-next-token';

export const getMyCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  let limit: number | undefined;
  let next: string | undefined;
  if (event.queryStringParameters) {
    if (event.queryStringParameters['limit']) {
      limit = parseInt(event.queryStringParameters['limit']);
    }
    next = event.queryStringParameters['next'];
  }

  const userUlid = getUserUlid(event);

  let nextToken: object | undefined = undefined;
  if (next) {
    nextToken = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
  }

  const pageOfCases = await listCasesForUser(userUlid, limit, nextToken, repositoryProvider);

  return {
    statusCode: 200,
    body: JSON.stringify({
      cases: pageOfCases,
      total: pageOfCases.count,
      next: getNextToken(pageOfCases.next),
    }),
  };
};
