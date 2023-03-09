/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCase } from '../services/case-service';
import { getCaseUsersForCase } from '../services/case-user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const getCaseMembership: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const paginationParams = getPaginationParameters(event);
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);

  const deaCase = await getCase(caseId, repositoryProvider);
  if (!deaCase) {
    throw new NotFoundError(`Case with ulid ${caseId} not found.`);
  }

  const pageOfCaseUsers = await getCaseUsersForCase(
    caseId,
    paginationParams.limit,
    paginationParams.nextToken,
    repositoryProvider
  );

  return responseOk({
    caseUsers: pageOfCaseUsers,
    total: pageOfCaseUsers.count,
    next: getNextToken(pageOfCaseUsers.next),
  });
};
