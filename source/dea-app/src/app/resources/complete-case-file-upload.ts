/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { CompleteCaseFileUploadDTO, CompleteCaseFileUploadObject } from '../../models/case-file';
import { completeCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { defaultParametersProvider } from '../../storage/parameters';
import { ValidationError } from '../exceptions/validation-exception';
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
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  _parametersProvider = defaultParametersProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);
  const requestCaseFile: CompleteCaseFileUploadDTO = getRequiredPayload(
    event,
    'Complete case file upload',
    completeCaseFileUploadRequestSchema
  );
  if (caseId !== requestCaseFile.caseUlid) {
    throw new ValidationError('Requested Case Ulid does not match resource');
  }
  if (fileId !== requestCaseFile.ulid) {
    throw new ValidationError('Requested File Ulid does not match resource');
  }

  const userUlid = getUserUlid(event);
  const existingFile = await validateCompleteCaseFileRequirements(
    requestCaseFile,
    userUlid,
    repositoryProvider
  );
  if (!existingFile.ulid) {
    throw new ValidationError('File not found');
  }
  const ulid = existingFile.ulid;
  const patchedFile: CompleteCaseFileUploadObject = Object.assign(
    {},
    {
      ulid,
      ...existingFile,
      uploadId: requestCaseFile.uploadId,
      fileS3Key: `${requestCaseFile.caseUlid}/${requestCaseFile.ulid}`,
    }
  );

  const completeUploadResponse = await CaseFileService.completeCaseFileUpload(
    patchedFile,
    repositoryProvider,
    datasetsProvider
  );

  return responseOk(event, completeUploadResponse);
};
