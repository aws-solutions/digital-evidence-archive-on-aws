/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileStatus } from './case-file-status';

export interface DeaCaseFile {
  readonly caseUlid: string;
  readonly fileName: string;
  readonly filePath: string;
  readonly isFile: boolean;
  readonly fileSizeMb: number;
  readonly createdBy: string;
  status: CaseFileStatus;
  readonly ulid?: string; // ulid will not exist before case-file is persisted
  readonly contentType?: string;
  readonly sha256Hash?: string;
  uploadId?: string;
  presignedUrls?: ReadonlyArray<string>;
  ttl?: number;
  versionId?: string;
  readonly created?: Date;
  readonly updated?: Date;
}
