/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredEnv, getRequiredPathParam } from '../../../lambda-http-helpers';
import { joiUlid } from '../../../models/validation/joi-common';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVaultFile } from '../../services/data-vault-file-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const getDataVaultFileAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const auditId = getRequiredPathParam(event, 'auditId', joiUlid);
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  await getRequiredDataVault(dataVaultId, providers.repositoryProvider);
  await getRequiredDataVaultFile(dataVaultId, fileId, providers.repositoryProvider);
  const subnetCIDR = getRequiredEnv('SOURCE_IP_MASK_CIDR');

  const result = await auditService.getAuditResult(
    auditId,
    `${dataVaultId}${fileId}`,
    AuditType.DATAVAULTFILE,
    providers.athenaClient,
    providers.repositoryProvider,
    `${event.requestContext.identity.sourceIp}/${subnetCIDR}`
  );

  return responseOk(event, result);
};
