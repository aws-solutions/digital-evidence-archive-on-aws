/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPayload } from '../../lambda-http-helpers';
import { DeaDataVaultInput } from '../../models/data-vault';
import { createDataVaultSchema } from '../../models/validation/data-vault';
import { defaultProvider } from '../../persistence/schema/entities';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createDataVault: DEAGatewayProxyHandler = async (
  event,
  context,
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const deaDataVault: DeaDataVaultInput = getRequiredPayload(
    event,
    'Create Data Vaults',
    createDataVaultSchema
  );

  const responseBody = await DataVaultService.createDataVault(deaDataVault, repositoryProvider);

  return responseOk(event, responseBody);
};
