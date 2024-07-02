/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOptionalPayload, getRequiredPathParam } from '../../../lambda-http-helpers';
import { DEAAuditQuery, defaultAuditQuery } from '../../../models/audit';
import { auditQuerySchema } from '../../../models/validation/audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const startDataVaultAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  const startAudit: DEAAuditQuery = getOptionalPayload(
    event,
    'Start data vault audit',
    auditQuerySchema,
    defaultAuditQuery
  );

  await getRequiredDataVault(dataVaultId, providers.repositoryProvider);

  const queryId = await auditService.requestAuditForDataVault(
    dataVaultId,
    startAudit.from,
    startAudit.to,
    `${dataVaultId}`,
    providers.athenaClient,
    providers.repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
