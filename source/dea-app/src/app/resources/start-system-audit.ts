/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOptionalPayload } from '../../lambda-http-helpers';
import { DEAAuditQuery, defaultAuditQuery } from '../../models/audit';
import { auditQuerySchema } from '../../models/validation/audit';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultAthenaClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const startSystemAudit: DEAGatewayProxyHandler = async (
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
  const startAudit: DEAAuditQuery = getOptionalPayload(
    event,
    'Start system audit',
    auditQuerySchema,
    defaultAuditQuery
  );
  const queryId = await auditService.requestSystemAudit(
    startAudit.from,
    startAudit.to,
    athenaClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
