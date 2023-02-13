/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../../logger';
import { defaultProvider } from '../../persistence/schema/entities';
import * as UserService from '../services/user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { getNextToken } from './get-next-token';

export const getUsers: DEAGatewayProxyHandler = async (
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

  let nextToken: object | undefined = undefined;
  if (next) {
    nextToken = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
  }

  const pageOfUsers = await UserService.getUsers(limit, nextToken, repositoryProvider);

  return {
    statusCode: 200,
    body: JSON.stringify({
      //intentionally unused tokenId - this removes it during the map operation
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      users: pageOfUsers.map(({ tokenId, ...user }) => user),
      total: pageOfUsers.count,
      next: getNextToken(pageOfUsers.next),
    }),
  };
};