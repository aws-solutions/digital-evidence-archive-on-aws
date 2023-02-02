/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../../logger';
import { defaultProvider } from '../../persistence/schema/entities';
import { listCasesForUser } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getMyCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });
  let limit: number | undefined;
  let next: string | undefined;
  if (event.queryStringParameters) {
    if (event.queryStringParameters['limit']) {
      limit = parseInt(event.queryStringParameters['limit']);
    }
    next = event.queryStringParameters['next'];
  }

  const userUlid = event.headers['userUlid'];
  if (!userUlid) {
    // runLambdaPreChecks should have added the userUlid, this is server error
    throw new Error('userUlid was not present in the event header');
  }

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

const getNextToken = (nextToken: object | undefined): string | undefined => {
  if (nextToken) {
    return Buffer.from(JSON.stringify(nextToken)).toString('base64');
  }
  return undefined;
};
