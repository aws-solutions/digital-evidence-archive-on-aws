/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface InitiateUploadForm {
  caseUlid: string;
  fileName: string;
  filePath: string;
  contentType: string;
  fileSizeMb: number;
  tag: string;
  details: string;
  reason: string;
}

export interface CompleteUploadForm {
  caseUlid: string;
  ulid?: string;
  sha256Hash?: string;
  uploadId?: string;
}
