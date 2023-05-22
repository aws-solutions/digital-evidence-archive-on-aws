/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import {
  getQueryParam,
  getRequiredCase,
  getRequiredCaseFile,
  getRequiredPathParam,
} from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultCloudwatchClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const startCaseFileAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  cloudwatchClient = defaultCloudwatchClient
) => {
  const now = Date.now();
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const start = getQueryParam(event, 'from', '0', Joi.number().integer());
  const end = getQueryParam(event, 'to', now.toString(), Joi.number().integer());
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);

  await getRequiredCase(caseId, repositoryProvider);
  await getRequiredCaseFile(caseId, fileId, repositoryProvider);

  const queryId = await auditService.requestAuditForCaseFile(
    caseId,
    fileId,
    startTime,
    endTime,
    `${caseId}${fileId}`,
    cloudwatchClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
