/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getUserUlid } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCaseUser } from '../services/case-user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getCaseActions: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const caseUlid = getRequiredPathParam(event, 'caseId', joiUlid);
  const userUlid = getUserUlid(event);

  const caseUser = await getCaseUser({ caseUlid, userUlid }, repositoryProvider);
  if (!caseUser) {
    throw new NotFoundError(`Could not find case: ${caseUlid} in the DB`);
  }

  return responseOk(caseUser);
};
