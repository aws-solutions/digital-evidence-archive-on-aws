/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredEnv, getRequiredPathParam } from '../../../lambda-http-helpers';
import { joiUlid } from '../../../models/validation/joi-common';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const getDataVaultAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const auditId = getRequiredPathParam(event, 'auditId', joiUlid);
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const subnetCIDR = getRequiredEnv('SOURCE_IP_MASK_CIDR');

  await getRequiredDataVault(dataVaultId, providers.repositoryProvider);

  const result = await auditService.getAuditResult(
    auditId,
    `${dataVaultId}`,
    AuditType.DATAVAULT,
    providers.athenaClient,
    providers.repositoryProvider,
    `${event.requestContext.identity.sourceIp}/${subnetCIDR}`
  );

  return responseOk(event, result);
};
