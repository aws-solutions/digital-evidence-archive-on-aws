/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { CompleteCaseFileUploadDTO } from '../../models/case-file';
import { completeCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import * as CaseFileService from '../services/case-file-service';
import { validateCompleteCaseFileRequirements } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const completeCaseFileUpload: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  const requestCaseFile: CompleteCaseFileUploadDTO = getRequiredPayload(
    event,
    'Complete case file upload',
    completeCaseFileUploadRequestSchema
  );

  event.headers['caseFileHash'] = requestCaseFile.sha256Hash;

  const userUlid = getUserUlid(event);
  const existingFile = await validateCompleteCaseFileRequirements(
    requestCaseFile,
    userUlid,
    repositoryProvider
  );
  const patchedFile = Object.assign(
    {},
    {
      ...existingFile,
      uploadId: requestCaseFile.uploadId,
      sha256Hash: requestCaseFile.sha256Hash,
    }
  );

  const completeUploadResponse = await CaseFileService.completeCaseFileUpload(
    patchedFile,
    repositoryProvider,
    datasetsProvider
  );

  return responseOk(event, completeUploadResponse);
};
