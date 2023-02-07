/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaCaseFile {
  readonly caseUlid: string;
  readonly fileName: string;
  readonly filePath: string;
  readonly isFile: boolean;
  readonly ulid?: string; // ulid will not exist before case-file is persisted
  readonly fileSizeMb: number;
  readonly preSignedUrls?: [string];
  readonly contentType?: string;
  readonly uploadId?: string;
  readonly sha256Hash?: string;
  readonly contentPath?: string;
  readonly created?: Date;
  readonly updated?: Date;
}
