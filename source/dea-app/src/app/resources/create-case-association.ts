/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  getPaginationParameters,
  getRequiredPathParam,
  getRequiredPayload,
  getUserUlid,
} from '../../lambda-http-helpers';
import { caseAssociationDTO } from '../../models/case-file';
import { caseAssociationRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';

import { associateFilesListToCase, fetchNestedFilesInFolders } from '../services/data-vault-file-service';
import { getDataVault } from '../services/data-vault-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createCaseAssociation: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  const caseAssociationRequest: caseAssociationDTO = getRequiredPayload(
    event,
    'Create case associations',
    caseAssociationRequestSchema
  );

  const DataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const deaDataVault = await getDataVault(DataVaultId, repositoryProvider);
  if (!deaDataVault) {
    throw new NotFoundError(`Could not find DataVault: ${DataVaultId} in the DB`);
  }

  const paginationParams = getPaginationParameters(event);

  const userUlid = getUserUlid(event);

  // Get all file ulids and omit folders
  const allFileUlids = await fetchNestedFilesInFolders(
    DataVaultId,
    caseAssociationRequest.fileUlids,
    paginationParams.limit,
    repositoryProvider
  );

  const filesTransferred = await associateFilesListToCase(
    DataVaultId,
    userUlid,
    caseAssociationRequest.caseUlids,
    allFileUlids,
    repositoryProvider
  );

  return responseOk(event, { filesTransferred });
};
