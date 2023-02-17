/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getUserUlid } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCaseFile } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { completeCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { getCaseFileByUlid } from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { getCase } from '../services/case-service';
import { getUser } from '../services/user-service';
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
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  if (!event.body) {
    throw new ValidationError('Complete case file upload payload missing.');
  }

  const requestCaseFile: DeaCaseFile = JSON.parse(event.body);
  Joi.assert(requestCaseFile, completeCaseFileUploadRequestSchema);

  const userUlid = getUserUlid(event);
  const user = await getUser(userUlid, repositoryProvider);
  if (!user) {
    // Note: before every lambda checks are run to add first time
    // federated users to the db. If the caller is not in the db
    // a server error has occurred
    throw new Error('Could not find case-file uploader as a user in the DB');
  }

  const deaCase = await getCase(requestCaseFile.caseUlid, repositoryProvider);
  if (!deaCase) {
    throw new Error(`Could not find case: ${requestCaseFile.caseUlid} in the DB`);
  }

  if (deaCase.status != CaseStatus.ACTIVE) {
    throw new Error(`Can't upload a file to case in ${deaCase.status} state`);
  }

  // we know based on request validation that the ulid isn't null, so safe to cast to string
  const existingCaseFile = await getCaseFileByUlid(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    requestCaseFile.ulid as string,
    requestCaseFile.caseUlid,
    repositoryProvider
  );
  if (!existingCaseFile) {
    throw new Error(`Could not find file: ${requestCaseFile.ulid} in the DB`);
  }

  if (existingCaseFile.status != CaseFileStatus.PENDING) {
    throw new Error(`Can't complete upload for a file in ${existingCaseFile.status} state`);
  }

  if (existingCaseFile.createdBy !== userUlid) {
    throw new Error('Mismatch in user creating and completing file upload');
  }

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
