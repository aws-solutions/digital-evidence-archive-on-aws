/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from '@aws/dea-app/lib/models/case-status';

export interface CreateCaseForm {
  name: string;
  description?: string;
}

export interface UpdateCaseStatusForm {
  name: string;
  caseId: string;
  status: CaseStatus;
  deleteFiles: boolean;
}
