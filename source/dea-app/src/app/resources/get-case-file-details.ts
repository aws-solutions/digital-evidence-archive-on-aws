/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCaseFile } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getCaseFileDetails: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId');
  const fileId = getRequiredPathParam(event, 'fileId');

  const retrievedCaseFile = await getCaseFile(caseId, fileId, repositoryProvider);
  if (!retrievedCaseFile) {
    throw new NotFoundError(`Could not find file: ${fileId} in the DB`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(retrievedCaseFile),
  };
};
