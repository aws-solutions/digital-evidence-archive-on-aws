/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { InitiateCaseFileUploadDTO } from '../../models/case-file';
import { initiateCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { validateInitiateUploadRequirements } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const initiateCaseFileUpload: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const requestCaseFile: InitiateCaseFileUploadDTO = getRequiredPayload(
    event,
    'Initiate case file upload',
    initiateCaseFileUploadRequestSchema
  );
  if (caseId !== requestCaseFile.caseUlid) {
    throw new ValidationError('Requested Case Ulid does not match resource');
  }

  const userUlid = getUserUlid(event);
  await validateInitiateUploadRequirements(requestCaseFile, userUlid, repositoryProvider);

  const initiateUploadResponse = await CaseFileService.initiateCaseFileUpload(
    requestCaseFile,
    userUlid,
    repositoryProvider,
    datasetsProvider
  );

  return responseOk(event, initiateUploadResponse);
};
