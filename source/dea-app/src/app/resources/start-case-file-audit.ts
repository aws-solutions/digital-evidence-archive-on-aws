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
import { getRequiredCaseFile } from '../services/case-file-service';
import { getRequiredCase } from '../services/case-service';
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
  athenaClient = defaultAthenaClient
) => {
  const now = Date.now();
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const start = getQueryParam(event, 'from', '0', Joi.date().timestamp('unix'));
  const end = getQueryParam(event, 'to', now.toString(), Joi.date().timestamp('unix'));
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);

  await getRequiredCase(caseId, repositoryProvider);
  const caseFile = await getRequiredCaseFile(caseId, fileId, repositoryProvider);

  const queryId = await auditService.requestAuditForCaseFile(
    {
      caseId,
      fileId,
      fileName: caseFile.fileName,
      filePath: caseFile.filePath,
    },
    startTime,
    endTime,
    `${caseId}${fileId}`,
    athenaClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
