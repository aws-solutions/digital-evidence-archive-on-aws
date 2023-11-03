/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getQueryParam, getRequiredPathParam } from '../../../lambda-http-helpers';
import { joiUlid } from '../../../models/validation/joi-common';
import { defaultProvider } from '../../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../../storage/datasets';
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
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  athenaClient = defaultAthenaClient
) => {
  const now = Date.now();
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const start = getQueryParam(event, 'from', '0', Joi.date().timestamp('unix'));
  const end = getQueryParam(event, 'to', now.toString(), Joi.date().timestamp('unix'));
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);

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
    startTime,
    endTime,
    `${dataVaultId}${fileId}`,
    athenaClient,
    repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
