/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOptionalPayload, getRequiredPathParam } from '../../../lambda-http-helpers';
import { DEAAuditQuery, defaultAuditQuery } from '../../../models/audit';
import { auditQuerySchema } from '../../../models/validation/audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVaultFile } from '../../services/data-vault-file-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const startDataVaultFileAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const startAudit: DEAAuditQuery = getOptionalPayload(
    event,
    'Start data vault file audit',
    auditQuerySchema,
    defaultAuditQuery
  );

  await getRequiredDataVault(dataVaultId, providers.repositoryProvider);
  const caseFile = await getRequiredDataVaultFile(dataVaultId, fileId, providers.repositoryProvider);

  const queryId = await auditService.requestAuditForDataVaultFile(
    {
      dataVaultId,
      fileId,
      fileName: caseFile.fileName,
      filePath: caseFile.filePath,
      s3Key: caseFile.fileS3Key,
    },
    startAudit.from,
    startAudit.to,
    `${dataVaultId}${fileId}`,
    providers.athenaClient,
    providers.repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
