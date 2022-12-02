/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from './case-status';

export interface DeaCase {
  ulid?: string;
  name: string;
  status: CaseStatus;
  description?: string;
  objectCount?: number;
}
