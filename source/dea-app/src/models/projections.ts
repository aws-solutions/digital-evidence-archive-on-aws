/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '../models/case';
import { CaseType } from '../persistence/schema/entities';
import { CaseStatus } from './case-status';

export const caseFromEntity = (caseEntity?: CaseType): DeaCase | undefined => {
  if (caseEntity) {
    return {
      ulid: caseEntity.ulid,
      name: caseEntity.name,
      description: caseEntity.description,
      objectCount: caseEntity.objectCount,
      // status schema is defined with CaseStatus so we can safely cast here
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      status: caseEntity.status as CaseStatus,
    };
  }
  return undefined;
};
