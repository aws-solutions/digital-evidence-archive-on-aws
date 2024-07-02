/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { NotFoundError } from '../exceptions/not-found-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getCase: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);

  const retreivedCase = await CaseService.getCase(caseId, providers.repositoryProvider);
  if (!retreivedCase) {
    throw new NotFoundError(`Case with ulid ${caseId} not found.`);
  }

  return responseOk(event, retreivedCase);
};
