/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DeaCase } from '../../models/case';
import { updateCaseSchema } from '../../models/validation/case';
import { joiUlid } from '../../models/validation/joi-common';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const updateCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);

  const deaCase: DeaCase = getRequiredPayload(event, 'Update cases', updateCaseSchema);

  if (caseId !== deaCase.ulid) {
    throw new ValidationError('Requested Case Ulid does not match resource');
  }

  const caseUpdateResult = await CaseService.updateCases(deaCase, providers.repositoryProvider);

  return responseOk(event, caseUpdateResult);
};
