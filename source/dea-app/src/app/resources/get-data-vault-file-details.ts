/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getDataVaultFile, hydrateUsersForDataVaultFiles } from '../services/data-vault-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getDataVaultFileDetails: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default dataVault is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const retrievedDataVaultFile = await getDataVaultFile(dataVaultId, fileId, repositoryProvider);
  if (!retrievedDataVaultFile) {
    throw new NotFoundError(`Could not find file: ${fileId} in the DB`);
  }

  const hydratedFiles = await hydrateUsersForDataVaultFiles([retrievedDataVaultFile], repositoryProvider);

  return responseOk(event, hydratedFiles[0]);
};
