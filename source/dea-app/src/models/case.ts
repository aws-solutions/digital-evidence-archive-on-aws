/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from './case-action';
import { CaseFileStatus } from './case-file-status';
import { CaseStatus } from './case-status';

export interface DeaCase {
  readonly ulid: string;
  readonly name: string;
  readonly status: CaseStatus;
  readonly description?: string;
  readonly objectCount: number;
  readonly totalSizeBytes: number;
  readonly filesStatus: CaseFileStatus;
  readonly s3BatchJobId?: string;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface MyCase extends DeaCase {
  readonly actions: CaseAction[];
}

export interface ScopedDeaCase {
  readonly ulid: string;
  readonly name: string;
}

export interface DeaCaseInput {
  readonly name: string;
  readonly description?: string;
}

export interface UpdateCaseStatusInput {
  readonly name: string;
  readonly status: CaseStatus;
  readonly deleteFiles: boolean;
}
