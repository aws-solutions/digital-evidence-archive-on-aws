/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { CaseOwnerDTO } from '../../models/dtos/case-user-dto';
import { caseOwnerSchema } from '../../models/validation/case-user';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import { createCaseOwnerFromDTO } from '../services/case-user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createCaseOwner: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);

  const caseOwner: CaseOwnerDTO = getRequiredPayload(event, 'CaseOwner', caseOwnerSchema);

  if (caseId !== caseOwner.caseUlid) {
    throw new ValidationError('Requested Case Ulid does not match resource');
  }

  const caseUserResult = await createCaseOwnerFromDTO(caseOwner, repositoryProvider);
  return responseOk(event, caseUserResult);
};
