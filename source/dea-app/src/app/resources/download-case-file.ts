/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredEnv, getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DownloadCaseFileRequest } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { downloadFileRequestBodySchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider, getPresignedUrlForDownload } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import { getRequiredCaseFile } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const downloadCaseFile: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);
  const subnetCIDR = getRequiredEnv('SOURCE_IP_MASK_CIDR');

  const body = getRequiredPayload<DownloadCaseFileRequest>(event, 'downloadCaseFile request body', downloadFileRequestBodySchema);
  const downloadReason :string | undefined = body.downloadReason; 

  const retrievedCaseFile = await getRequiredCaseFile(caseId, fileId, repositoryProvider);

  if (retrievedCaseFile.status !== CaseFileStatus.ACTIVE) {
    throw new ValidationError(`Can't download a file in ${retrievedCaseFile.status} state`);
  }

  const downloadResult = await getPresignedUrlForDownload(
    retrievedCaseFile,
    `${event.requestContext.identity.sourceIp}/${subnetCIDR}`,
    datasetsProvider,
    downloadReason
  );

  return responseOk(event, downloadResult);
};
