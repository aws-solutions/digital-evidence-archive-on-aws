/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { DeaDataVaultUpdateInput } from '../../models/data-vault';
import { updateDataVaultSchema } from '../../models/validation/data-vault';
import { joiUlid } from '../../models/validation/joi-common';
import { ValidationError } from '../exceptions/validation-exception';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const updateDataVault: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  const deaDataVault: DeaDataVaultUpdateInput = getRequiredPayload(
    event,
    'Update Data Vault',
    updateDataVaultSchema
  );

  if (dataVaultId !== deaDataVault.ulid) {
    throw new ValidationError('Requested DataVault Ulid does not match resource');
  }
  await DataVaultService.getDataVault(dataVaultId, providers.repositoryProvider);

  const dataVaultUpdateResult = await DataVaultService.updateDataVaults(
    deaDataVault,
    providers.repositoryProvider
  );

  return responseOk(event, dataVaultUpdateResult);
};
