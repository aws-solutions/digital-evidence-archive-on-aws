/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { defineAbility } from '@casl/ability';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getRequiredPathParam, getUserUlid } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { CaseAction } from '../../models/case-action';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider, ModelRepositoryProvider } from '../../persistence/schema/entities';
import { NotFoundError } from '../exceptions/not-found-exception';
import { getCaseUser } from '../services/case-user-service';

export type VerifyCaseACLsSignature = (
  event: APIGatewayProxyEventV2,
  requiredActions: ReadonlyArray<CaseAction>,
  repositoryProvider?: ModelRepositoryProvider
) => Promise<void>;

export const verifyCaseACLs: VerifyCaseACLsSignature = async (
  event,
  requiredActions,
  repositoryProvider = defaultProvider
) => {
  if (requiredActions.length === 0) {
    // No actions gating this handler
    return;
  }

  // CaseActions are only relevant on Cases, so we must have a caseId in the path to identify the target
  const caseUlid = getRequiredCaseIdFromPath(event);
  const userUlid = getUserUlid(event);

  // first confirm a case membership exists for this user
  const caseUser = await getCaseUser({ caseUlid, userUlid }, repositoryProvider);
  if (!caseUser) {
    // the user is not a member
    return userForbidden(event, { userUlid, caseUlid });
  }

  const userAbility = defineAbility((can) => {
    caseUser.actions.forEach((action) => {
      can(action, caseUlid);
    });
  });

  requiredActions.forEach((requiredAction) => {
    if (!userAbility.can(requiredAction, caseUlid)) {
      return userForbidden(event, { userUlid, caseUlid });
    }
  });
};

const userForbidden = (
  event: APIGatewayProxyEventV2,
  caseUserIds: {
    readonly caseUlid: string;
    readonly userUlid: string;
  }
) => {
  logger.warn(`Forbidden: ${event.rawPath}`, { user: caseUserIds.userUlid, case: caseUserIds.caseUlid });
  throw new NotFoundError('Resource not found');
};

const getRequiredCaseIdFromPath = (event: APIGatewayProxyEventV2): string => {
  return getRequiredPathParam(event, 'caseId', joiUlid);
};
