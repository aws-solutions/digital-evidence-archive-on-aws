/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import { caseUserSchema } from '../../models/validation/case-user';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import { createCaseUserMembershipFromDTO } from '../services/case-user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const createCaseMembership: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const caseId = getRequiredPathParam(event, 'caseId');

  if (!event.body) {
    throw new ValidationError('CaseUser payload missing.');
  }

  const caseUser: CaseUserDTO = JSON.parse(event.body);
  Joi.assert(caseUser, caseUserSchema);

  if (caseId !== caseUser.caseUlid) {
    throw new ValidationError('Requested Case Ulid does not match resource');
  }

  const caseUserResult = await createCaseUserMembershipFromDTO(caseUser, repositoryProvider);
  return {
    statusCode: 200,
    body: JSON.stringify(caseUserResult),
  };
};
