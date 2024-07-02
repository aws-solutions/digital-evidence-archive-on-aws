/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { RemoveCaseAssociationDTO } from '../../models/case-file';
import { removeCaseAssociationRequestSchema } from '../../models/validation/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import { disassociateFileFromCases } from '../services/data-vault-file-service';
import { DEAGatewayProxyHandler, defaultProviders } from './dea-gateway-proxy-handler';
import { responseNoContent } from './dea-lambda-utils';

export const deleteCaseAssociation: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default cases are handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const dataVaultId = getRequiredPathParam(event, 'dataVaultId', joiUlid);
  const fileId = getRequiredPathParam(event, 'fileId', joiUlid);
  const removeCaseAssociationRequest: RemoveCaseAssociationDTO = getRequiredPayload(
    event,
    'Remove case associations',
    removeCaseAssociationRequestSchema
  );

  await disassociateFileFromCases(
    dataVaultId,
    fileId,
    removeCaseAssociationRequest.caseUlids,
    providers.repositoryProvider
  );

  return responseNoContent(event);
};
