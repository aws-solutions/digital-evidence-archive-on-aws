/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { deleteCaseUser } from '../services/case-user-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseNoContent } from './dea-lambda-utils';

export const deleteCaseMembership: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const userId = getRequiredPathParam(event, 'userId', joiUlid);

  await deleteCaseUser(userId, caseId, providers.repositoryProvider);
  return responseNoContent(event);
};
