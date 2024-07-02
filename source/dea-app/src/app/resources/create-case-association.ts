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
import { CaseAssociationDTO } from '../../models/case-file';
import { caseAssociationRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import {
  associateFilesListToCase,
  enforceCaseAssociationLimitProtection,
  fetchNestedFilesInFolders,
} from '../services/data-vault-file-service';
import { getRequiredDataVault } from '../services/data-vault-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const createCaseAssociation: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const caseAssociationRequest: CaseAssociationDTO = getRequiredPayload(
    event,
    'Create case associations',
    caseAssociationRequestSchema
  );

  const DataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  await getRequiredDataVault(DataVaultId, providers.repositoryProvider);

  const paginationParams = getPaginationParameters(event);

  const userUlid = getUserUlid(event);

  enforceCaseAssociationLimitProtection(caseAssociationRequest.fileUlids.length);

  // Get all file ulids and omit folders
  const allFileUlids = await fetchNestedFilesInFolders(
    DataVaultId,
    caseAssociationRequest.fileUlids,
    paginationParams.limit,
    providers.repositoryProvider
  );

  const filesTransferred = await associateFilesListToCase(
    DataVaultId,
    userUlid,
    caseAssociationRequest.caseUlids,
    allFileUlids,
    providers.repositoryProvider
  );

  return responseOk(event, { filesTransferred });
};
