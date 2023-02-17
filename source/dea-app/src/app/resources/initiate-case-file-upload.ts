/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload, getUserUlid } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCaseFile } from '../../models/case-file';
import { initiateCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import * as CaseFileService from '../services/case-file-service';
import { validateInitiateUploadRequirements } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const initiateCaseFileUpload: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  const requestCaseFile: DeaCaseFile = getRequiredPayload(
    event,
    'Initiate case file upload',
    initiateCaseFileUploadRequestSchema
  );

  const userUlid = getUserUlid(event);
  await validateInitiateUploadRequirements(requestCaseFile, userUlid, repositoryProvider);

  const initiateUploadResponse = await CaseFileService.initiateCaseFileUpload(
    requestCaseFile,
    userUlid,
    repositoryProvider,
    datasetsProvider
  );

  return {
    statusCode: 200,
    body: JSON.stringify(initiateUploadResponse),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
