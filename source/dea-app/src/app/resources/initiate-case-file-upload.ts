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
import { initiateCaseFileUploadRequestSchema } from '../../models/validation/case-file';
import { getCaseFileByFileLocation } from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { getCase } from '../services/case-service';
import { getUser } from '../services/user-service';
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

  if (!event.body) {
    throw new ValidationError('Initiate case file upload payload missing.');
  }

  const requestCaseFile: DeaCaseFile = JSON.parse(event.body);
  Joi.assert(requestCaseFile, initiateCaseFileUploadRequestSchema);

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

  const existingCaseFile = await getCaseFileByFileLocation(
    requestCaseFile.caseUlid,
    requestCaseFile.filePath,
    requestCaseFile.fileName,
    repositoryProvider
  );

  if (existingCaseFile) {
    // todo: the error experience of this scenario can be improved upon based on UX/customer feedback
    // todo: add more protection to prevent creation of 2 files with same filePath+fileName
    if (existingCaseFile.status == CaseFileStatus.PENDING) {
      throw new Error(
        `${existingCaseFile.filePath}${existingCaseFile.fileName} is currently being uploaded. Check again in 60 minutes`
      );
    }
    throw new Error(`${existingCaseFile.filePath}${existingCaseFile.fileName} already exists in the DB`);
  }

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
