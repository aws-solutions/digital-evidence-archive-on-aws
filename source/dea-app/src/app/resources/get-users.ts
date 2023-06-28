/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import * as UserService from '../services/user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getUsers: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  let nameBeginsWith: string | undefined;
  if (event.queryStringParameters) {
    nameBeginsWith = event.queryStringParameters['nameBeginsWith'];
  }

  const paginationParams = getPaginationParameters(event);
  const pageOfUsers = await UserService.getUsers(
    nameBeginsWith,
    repositoryProvider,
    paginationParams.nextToken,
    paginationParams.limit
  );

  return responseOk(event, {
    //remove tokenId and idPoolId
    users: pageOfUsers.map((user) => {
      return {
        ulid: user.ulid,
        firstName: user.firstName,
        lastName: user.lastName,
        created: user.created,
        updated: user.updated,
      };
    }),
    total: pageOfUsers.count,
    next: getNextToken(pageOfUsers.next),
  });
};
