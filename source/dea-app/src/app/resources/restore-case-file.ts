/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { CaseFileStatus } from '../../models/case-file-status';
import { joiUlid } from '../../models/validation/joi-common';
import { restoreObject } from '../../storage/datasets';
import { ValidationError } from '../exceptions/validation-exception';
import { getRequiredCaseFile } from '../services/case-file-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseNoContent } from './dea-lambda-utils';

export const restoreCaseFile: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const retrievedCaseFile = await getRequiredCaseFile(caseId, fileId, providers.repositoryProvider);
  if (retrievedCaseFile.status !== CaseFileStatus.ACTIVE) {
    throw new ValidationError(`Can't restore a file in ${retrievedCaseFile.status} state`);
  }

  await restoreObject(retrievedCaseFile, providers.datasetsProvider);

  return responseNoContent(event);
};
