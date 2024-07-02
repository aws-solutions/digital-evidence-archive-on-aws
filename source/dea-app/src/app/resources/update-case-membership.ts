/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import { caseUserSchema } from '../../models/validation/case-user';
import { joiUlid } from '../../models/validation/joi-common';
import { ValidationError } from '../exceptions/validation-exception';
import { updateCaseUserMembershipFromDTO } from '../services/case-user-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const updateCaseMembership: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const userId = getRequiredPathParam(event, 'userId', joiUlid);

  const caseUser: CaseUserDTO = getRequiredPayload(event, 'CaseUser', caseUserSchema);

  if (caseId !== caseUser.caseUlid) {
    throw new ValidationError('Requested Case id does not match resource');
  }

  if (userId !== caseUser.userUlid) {
    throw new ValidationError('Requested User id does not match resource');
  }

  const caseUserResult = await updateCaseUserMembershipFromDTO(caseUser, providers.repositoryProvider);

  return responseOk(event, caseUserResult);
};
