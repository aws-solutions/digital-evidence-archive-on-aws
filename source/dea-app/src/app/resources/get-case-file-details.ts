/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCaseFile, hydrateUsersForFiles } from '../services/case-file-service';
import { getDataVault } from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getCaseFileDetails: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const retrievedCaseFile = await getCaseFile(caseId, fileId, repositoryProvider);
  if (!retrievedCaseFile) {
    throw new NotFoundError(`Could not find file: ${fileId} in the DB`);
  }

  const hydratedFiles = await hydrateUsersForFiles([retrievedCaseFile], repositoryProvider);

  if (hydratedFiles[0].dataVaultUlid) {
    const dataVault = await getDataVault(hydratedFiles[0].dataVaultUlid, repositoryProvider);
    if (dataVault) {
      hydratedFiles[0].dataVaultName = dataVault.name;
    }
  }

  return responseOk(event, hydratedFiles[0]);
};
