/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import * as CasePersistence from '../../persistence/case';

export const createCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  const currentCase: DeaCase = {
    ...deaCase,
    status: CaseStatus.ACTIVE,
    objectCount: 0,
  };

  // TODO: create initial User/Owner on CreateCase

  return await CasePersistence.createCase(currentCase);
};

export const updateCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  return await CasePersistence.updateCase(deaCase);
};

export const deleteCase = async (caseUlid: string): Promise<void> => {
  return await CasePersistence.deleteCase(caseUlid);
};
