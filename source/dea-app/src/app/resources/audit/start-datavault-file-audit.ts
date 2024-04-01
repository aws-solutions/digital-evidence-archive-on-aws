/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getOptionalPayload, getRequiredPathParam } from '../../../lambda-http-helpers';
import { DEAAuditQuery, defaultAuditQuery } from '../../../models/audit';
import { auditQuerySchema } from '../../../models/validation/audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { defaultProvider } from '../../../persistence/schema/entities';
import { defaultCacheProvider } from '../../../storage/cache';
import { defaultDatasetsProvider } from '../../../storage/datasets';
import { defaultParametersProvider } from '../../../storage/parameters';
import { defaultAthenaClient } from '../../audit/dea-audit-plugin';
import { auditService } from '../../services/audit-service';
import { getRequiredDataVaultFile } from '../../services/data-vault-file-service';
import { getRequiredDataVault } from '../../services/data-vault-service';
import { DEAGatewayProxyHandler } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const startDataVaultFileAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  _cacheProvider = defaultCacheProvider,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  _parametersProvider = defaultParametersProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  athenaClient = defaultAthenaClient
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const startAudit: DEAAuditQuery = getOptionalPayload(
    event,
    'Start data vault file audit',
    auditQuerySchema,
    defaultAuditQuery
  );

  await getRequiredDataVault(dataVaultId, repositoryProvider);
  const caseFile = await getRequiredDataVaultFile(dataVaultId, fileId, repositoryProvider);

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
    athenaClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
