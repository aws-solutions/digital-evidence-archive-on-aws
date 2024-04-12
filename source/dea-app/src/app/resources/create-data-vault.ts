/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload } from '../../lambda-http-helpers';
import { DeaDataVaultInput } from '../../models/data-vault';
import { createDataVaultSchema } from '../../models/validation/data-vault';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createDataVault: DEAGatewayProxyHandler = async (
  event,
  context,
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const deaDataVault: DeaDataVaultInput = getRequiredPayload(
    event,
    'Create Data Vaults',
    createDataVaultSchema
  );

  const responseBody = await DataVaultService.createDataVault(deaDataVault, providers.repositoryProvider);

  return responseOk(event, responseBody);
};
