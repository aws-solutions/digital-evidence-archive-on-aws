/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  getRequiredEnv,
  getRequiredPathParam,
  getRequiredPayload,
  getUserUlid,
} from '../../lambda-http-helpers';
import { InitiateCaseFileUploadDTO } from '../../models/case-file';
import { initiateCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { validateInitiateUploadRequirements } from '../services/case-file-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const initiateCaseFileUpload: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
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
  if (!requestCaseFile.uploadId) {
    await validateInitiateUploadRequirements(requestCaseFile, userUlid, providers.repositoryProvider);
  }
  const subnetCIDR = getRequiredEnv('SOURCE_IP_MASK_CIDR');

  const initiateUploadResponse = await CaseFileService.initiateCaseFileUpload(
    requestCaseFile,
    userUlid,
    `${event.requestContext.identity.sourceIp}/${subnetCIDR}`,
    providers.repositoryProvider,
    providers.datasetsProvider
  );

  return responseOk(event, initiateUploadResponse);
};
