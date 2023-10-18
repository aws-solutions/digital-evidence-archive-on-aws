/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import Joi from 'joi';
import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import { joiUlid, filePath as filePathRegex } from '../../models/validation/joi-common';
import { getDataVault } from '../../persistence/data-vault';
import { listDataVaultFilesByFilePath } from '../../persistence/data-vault-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { hydrateUsersForDataVaultFiles } from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const listDataVaultFiles: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default DataVault is handled in e2e tests */
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

  const DataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const deaDataVault = await getDataVault(DataVaultId, repositoryProvider);
  if (!deaDataVault) {
    throw new NotFoundError(`Could not find DataVault: ${DataVaultId} in the DB`);
  }

  const pageOfDataVaultFiles: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
    DataVaultId,
    filePath,
    paginationParams.limit,
    repositoryProvider,
    paginationParams.nextToken
  );

  const hydratedFiles = await hydrateUsersForDataVaultFiles(pageOfDataVaultFiles, repositoryProvider);

  return responseOk(event, {
    files: hydratedFiles,
    total: pageOfDataVaultFiles.count,
    next: getNextToken(pageOfDataVaultFiles.next),
  });
};
