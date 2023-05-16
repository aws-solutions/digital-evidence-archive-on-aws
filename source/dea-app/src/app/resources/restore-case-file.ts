/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { CaseFileStatus } from '../../models/case-file-status';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider, restoreObject } from '../../storage/datasets';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError } from '../exceptions/validation-exception';
import { getCaseFile } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseNoContent } from './dea-lambda-utils';

export const restoreCaseFile: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const retrievedCaseFile = await getCaseFile(caseId, fileId, repositoryProvider);
  if (!retrievedCaseFile) {
    throw new NotFoundError(`Could not find file: ${fileId} in the DB`);
  }
  if (retrievedCaseFile.status !== CaseFileStatus.ACTIVE) {
    throw new ValidationError(`Can't restore a file in ${retrievedCaseFile.status} state`);
  }

  await restoreObject(retrievedCaseFile, datasetsProvider);

  return responseNoContent(event);
};
