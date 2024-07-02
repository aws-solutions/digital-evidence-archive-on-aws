/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import Joi from 'joi';
import { getPaginationParameters, getRequiredPathParam } from '../../lambda-http-helpers';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import { filePath as filePathRegex, joiUlid } from '../../models/validation/joi-common';
import {
  hydrateUsersForDataVaultFiles,
  listDataVaultFilesByFilePath,
} from '../services/data-vault-file-service';
import { getRequiredDataVault } from '../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';
import { getNextToken } from './get-next-token';

export const listDataVaultFiles: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default DataVault is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
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
  await getRequiredDataVault(DataVaultId, providers.repositoryProvider);

  const pageOfDataVaultFiles: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
    DataVaultId,
    filePath,
    paginationParams.limit,
    providers.repositoryProvider,
    paginationParams.nextToken
  );

  const hydratedFiles = await hydrateUsersForDataVaultFiles(
    pageOfDataVaultFiles,
    providers.repositoryProvider
  );

  return responseOk(event, {
    files: hydratedFiles,
    total: pageOfDataVaultFiles.count,
    next: getNextToken(pageOfDataVaultFiles.next),
  });
};
