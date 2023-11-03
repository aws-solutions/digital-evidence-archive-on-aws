/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../../lambda-http-helpers';
import { joiUlid } from '../../../models/validation/joi-common';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { defaultProvider } from '../../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../../storage/datasets';
import { defaultAthenaClient } from '../../audit/dea-audit-plugin';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVaultFile } from '../../services/data-vault-file-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const getDataVaultFileAudit: DEAGatewayProxyHandler = async (
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
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  await getRequiredDataVault(dataVaultId, repositoryProvider);
  await getRequiredDataVaultFile(dataVaultId, fileId, repositoryProvider);

  const result = await auditService.getAuditResult(
    auditId,
    `${dataVaultId}${fileId}`,
    AuditType.DATAVAULTFILE,
    athenaClient,
    repositoryProvider,
    `${event.requestContext.identity.sourceIp}/32`
  );

  return responseOk(event, result);
};
