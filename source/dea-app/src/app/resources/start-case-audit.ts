/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getQueryParam, getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { getRequiredCase } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const startCaseAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  athenaClient = defaultAthenaClient
) => {
  const now = Date.now();
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const start = getQueryParam(event, 'from', '0', Joi.date().timestamp('unix'));
  const end = getQueryParam(event, 'to', now.toString(), Joi.date().timestamp('unix'));
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);

  await getRequiredCase(caseId, repositoryProvider);

  const queryId = await auditService.requestAuditForCase(
    caseId,
    startTime,
    endTime,
    caseId,
    athenaClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
