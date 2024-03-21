/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import Joi from 'joi';
import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import { filePath as filePathRegex, joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import {
  hydrateUsersForDataVaultFiles,
  listDataVaultFilesByFilePath,
} from '../services/data-vault-file-service';
import { getRequiredDataVault } from '../services/data-vault-service';
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
  await getRequiredDataVault(DataVaultId, repositoryProvider);

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
