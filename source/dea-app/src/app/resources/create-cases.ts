/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { DeaCase } from '../../models/case';
import { createCaseSchema } from '../../models/validation/case';
import { defaultProvider } from '../../persistence/schema/entities';
import * as CaseService from '../services/case-service';
import { getUser } from '../services/user-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createCases: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
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

  // Add the new caseId to the event header, so it will be added
  // to the audit event, and will show up in case audit
  event.headers['caseId'] = updateBody.ulid;

  return responseOk(event, updateBody);
};
