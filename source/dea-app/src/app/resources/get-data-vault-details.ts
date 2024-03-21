/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import * as DataVaultService from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getDataVault: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);

  const retreivedDataVault = await DataVaultService.getRequiredDataVault(dataVaultId, repositoryProvider);

  return responseOk(event, retreivedDataVault);
};
