/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOptionalPayload } from '../../../lambda-http-helpers';
import { DEAAuditQuery, defaultAuditQuery } from '../../../models/audit';
import { auditQuerySchema } from '../../../models/validation/audit';
import { auditService } from '../../services/audit-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const startSystemAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
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
    providers.athenaClient,
    providers.repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
