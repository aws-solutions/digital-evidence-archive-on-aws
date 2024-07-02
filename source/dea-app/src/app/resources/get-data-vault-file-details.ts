/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { getRequiredDataVaultFile, hydrateDataVaultFile } from '../services/data-vault-file-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getDataVaultFileDetails: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default dataVault is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);

  const retrievedDataVaultFile = await getRequiredDataVaultFile(
    dataVaultId,
    fileId,
    providers.repositoryProvider
  );

  const hydratedFile = await hydrateDataVaultFile(retrievedDataVaultFile, providers.repositoryProvider);

  return responseOk(event, hydratedFile);
};
