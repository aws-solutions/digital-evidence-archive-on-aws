/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { getRequiredCaseFile } from '../services/case-file-service';
import { getRequiredCase } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getCaseFileAudit: DEAGatewayProxyHandler = async (
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
  const auditId = getRequiredPathParam(event, 'auditId', joiUlid);
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  await getRequiredCase(caseId, repositoryProvider);
  await getRequiredCaseFile(caseId, fileId, repositoryProvider);

  const result = await auditService.getCaseFileAuditResult(
    auditId,
    `${caseId}${fileId}`,
    athenaClient,
    repositoryProvider,
    `${event.requestContext.identity.sourceIp}/32`
  );

  return responseOk(event, result);
};
