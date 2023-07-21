/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam, getRequiredPayload } from '../../lambda-http-helpers';
import { UpdateCaseStatusInput } from '../../models/case';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { updateCaseStatusSchema } from '../../models/validation/case';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider } from '../../storage/datasets';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const updateCaseStatus: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const input: UpdateCaseStatusInput = getRequiredPayload(
    event,
    'Update case status',
    updateCaseStatusSchema
  );
  const deaCase = await CaseService.getCase(caseId, repositoryProvider);

  if (!deaCase) {
    throw new NotFoundError(`Could not find case: ${input.name}`);
  }

  if (input.deleteFiles && !datasetsProvider.deletionAllowed) {
    throw new ValidationError('The application is not configured to delete files');
  }

  if (input.deleteFiles && input.status !== CaseStatus.INACTIVE) {
    throw new ValidationError('Delete files can only be requested when inactivating a case');
  }

  if (deaCase.filesStatus === CaseFileStatus.DELETING && input.status === CaseStatus.ACTIVE) {
    throw new ValidationError("Case status can't be changed to ACTIVE when its files are being deleted");
  }

  if (input.status === deaCase.status) {
    if (
      input.deleteFiles &&
      [CaseFileStatus.DELETING, CaseFileStatus.DELETED].includes(deaCase.filesStatus)
    ) {
      // Do nothing if requested case status matches current status and if files don't need to be deleted
      return responseOk(event, deaCase);
    }
    if (input.status === CaseStatus.ACTIVE) {
      // If case is active and requested status is active, then do nothing
      return responseOk(event, deaCase);
    }
  }

  const updatedCase = await CaseService.updateCaseStatus(
    deaCase,
    input.status,
    input.deleteFiles,
    repositoryProvider,
    datasetsProvider
  );
  return responseOk(event, updatedCase);
};
