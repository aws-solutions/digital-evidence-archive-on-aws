/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import { CaseStatus } from '@aws/dea-app/lib/models/case-status';

export interface DeaCaseDTO {
  readonly ulid: string;
  readonly name: string;
  readonly status: CaseStatus;
  readonly filesStatus: CaseFileStatus;
  readonly description?: string;
  readonly objectCount: number;
  readonly totalSizeBytes: number;
  readonly actions?: CaseAction[];
  readonly created: string;
  readonly updated: string;
}

export interface CaseFileDTO {
  readonly ulid: string;
  readonly caseUlid: string;
  readonly fileName: string;
  readonly contentType?: string;
  readonly createdBy: string;
  readonly filePath: string;
  readonly fileSizeBytes: number;
  readonly sha256Hash?: string;
  readonly status: string;
  readonly created?: Date;
  readonly updated?: Date;
  readonly isFile: boolean;
  readonly reason?: string;
  readonly details?: string;
}

export interface ScopedDeaCaseDTO {
  readonly ulid: string;
  readonly name: string;
}

export interface CaseOwnerDTO {
  readonly userUlid: string;
  readonly caseUlid: string;
}
