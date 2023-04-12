/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid, filePath as filePathRegex } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { listCaseFilesByFilePath } from '../services/case-file-service';
import { getCase } from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const listCaseFiles: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  let filePath = '/';
  if (event.queryStringParameters) {
    if (event.queryStringParameters['filePath']) {
      filePath = event.queryStringParameters['filePath'];
      Joi.assert(filePath, filePathRegex);
    }
  }
  const paginationParams = getPaginationParameters(event);

  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const deaCase = await getCase(caseId, repositoryProvider);
  if (!deaCase) {
    throw new NotFoundError(`Could not find case: ${caseId} in the DB`);
  }

  const pageOfCaseFiles = await listCaseFilesByFilePath(
    caseId,
    filePath,
    paginationParams.limit,
    repositoryProvider,
    paginationParams.nextToken
  );

  return responseOk(event, {
    files: pageOfCaseFiles,
    total: pageOfCaseFiles.count,
    next: getNextToken(pageOfCaseFiles.next),
  });
};
