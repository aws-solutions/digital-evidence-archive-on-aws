/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { DeaCaseFile } from '../../models/case-file';
import { completeCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import * as CaseFileService from '../services/case-file-service';
import { validateCompleteCaseFileRequirements } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const completeCaseFileUpload: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  const requestCaseFile: DeaCaseFile = getRequiredPayload(
    event,
    'Complete case file upload',
    completeCaseFileUploadRequestSchema
  );

  const userUlid = getUserUlid(event);
  await validateCompleteCaseFileRequirements(requestCaseFile, userUlid, repositoryProvider);

  const completeUploadResponse = await CaseFileService.completeCaseFileUpload(
    requestCaseFile,
    repositoryProvider,
    datasetsProvider
  );

  return {
    statusCode: 200,
    body: JSON.stringify(completeUploadResponse),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
