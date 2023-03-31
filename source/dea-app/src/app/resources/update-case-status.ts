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
import { ForbiddenError } from '../exceptions/forbidden-exception';
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
  repositoryProvider = defaultProvider
) => {
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const input: UpdateCaseStatusInput = getRequiredPayload(
    event,
    'Update case status',
    updateCaseStatusSchema
  );
  const deaCase = await CaseService.getCase(caseId, repositoryProvider);

  // TODO: add mechanism to check if this installation allows authorized users to delete files

  if (!deaCase) {
    throw new NotFoundError(`Could not find case: ${input.name}`);
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
      return responseOk(deaCase);
    }
    if (input.status === CaseStatus.ACTIVE) {
      // If case is active and requested status is active, then do nothing
      return responseOk(deaCase);
    }
  }

  const updateBody = await CaseService.updateCaseStatus(
    deaCase,
    input.status,
    input.deleteFiles,
    repositoryProvider
  );
  return responseOk(updateBody);
};
