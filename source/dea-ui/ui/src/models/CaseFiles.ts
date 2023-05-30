/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface InitiateUploadForm {
  caseUlid: string;
  fileName: string;
  filePath: string;
  contentType: string;
  fileSizeBytes: number;
  details: string;
  reason: string;
  chunkSizeBytes: number;
}

export interface CompleteUploadForm {
  caseUlid: string;
  ulid?: string;
  sha256Hash?: string;
  uploadId?: string;
}

export interface DownloadFileForm {
  caseUlid: string;
  ulid?: string;
}

export interface RestoreFileForm {
  caseUlid: string;
  ulid?: string;
}

export interface DownloadFileResult {
  downloadUrl?: string;
  isArchived?: boolean;
  isRestoring?: boolean;
}
