/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';

export interface CaseUserForm {
  caseUlid: string;
  userUlid: string;
  actions: CaseAction[];
}
