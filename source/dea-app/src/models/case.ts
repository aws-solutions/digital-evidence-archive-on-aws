/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from './case-status';

export interface DeaCase {
  readonly ulid: string;
  readonly name: string;
  readonly status: CaseStatus;
  readonly description?: string;
  readonly objectCount?: number;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface ScopedDeaCase {
  readonly ulid: string;
  readonly name: string;
}

export interface DeaCaseInput {
  readonly name: string;
  readonly description?: string;
}
