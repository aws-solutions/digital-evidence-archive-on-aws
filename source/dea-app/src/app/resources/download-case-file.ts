/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider, getPresignedUrlForDownload } from '../../storage/datasets';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCaseFile } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const downloadCaseFile: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId');
  const fileId = getRequiredPathParam(event, 'fileId');

  const retrievedCaseFile = await getCaseFile(caseId, fileId, repositoryProvider);
  if (!retrievedCaseFile) {
    throw new NotFoundError(`CaseFile: ${fileId} not found in Case: ${caseId}`);
  }

  const downloadUrl = getPresignedUrlForDownload(retrievedCaseFile, datasetsProvider);

  return {
    statusCode: 200,
    body: JSON.stringify({
      downloadUrl,
    }),
  };
};
