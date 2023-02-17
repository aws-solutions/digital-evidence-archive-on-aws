/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { createCaseSchema } from '../../models/validation/case';
import { defaultProvider } from '../../persistence/schema/entities';
import * as CaseService from '../services/case-service';
import { getUser } from '../services/user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const createCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const userUlid = getUserUlid(event);
  const user = await getUser(userUlid, repositoryProvider);
  if (!user) {
    // Note: before every lambda checks are run to add first time
    // federated users to the db. If the caller is not in the db
    // a server error has occured
    throw new Error('Could not find case creator as a user in the DB');
  }

  const deaCase: DeaCase = getRequiredPayload(event, 'Create cases', createCaseSchema);

  const updateBody = await CaseService.createCases(deaCase, user, repositoryProvider);

  return {
    statusCode: 200,
    body: JSON.stringify(updateBody),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
