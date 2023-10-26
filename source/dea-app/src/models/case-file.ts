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
  readonly fileSizeBytes: number;
  readonly createdBy: string;
  status: CaseFileStatus;
  readonly ulid?: string; // ulid will not exist before case-file is persisted
  readonly contentType?: string;
  readonly sha256Hash?: string;
  uploadId?: string;
  presignedUrls?: ReadonlyArray<string>;
  chunkSizeBytes?: number;
  ttl?: number;
  versionId?: string;
  readonly details?: string;
  readonly reason?: string;
  readonly fileS3Key: string;

  readonly created?: Date;
  readonly updated?: Date;
}

export interface DeaCaseFileResult {
  ulid: string;
  caseUlid: string;
  fileName: string;
  contentType?: string;
  createdBy: string;
  filePath: string;
  fileSizeBytes: number;
  uploadId?: string;
  sha256Hash?: string;
  versionId?: string;
  status: CaseFileStatus;
  created?: Date;
  updated?: Date;
  isFile: boolean;
  ttl?: number;
  reason?: string;
  details?: string;
  fileS3Key: string;
}

export interface DownloadCaseFileResult {
  downloadUrl?: string;
  isArchived?: boolean;
  isRestoring?: boolean;
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
  readonly fileS3Key: string;
}

export interface CompleteCaseFileUploadDTO {
  readonly caseUlid: string;
  readonly ulid: string;
  readonly sha256Hash: string;
  readonly uploadId: string;
}

export interface InitiateCaseFileUploadDTO {
  readonly caseUlid: string;
  readonly fileName: string;
  readonly filePath: string;
  readonly contentType: string;
  readonly fileSizeBytes: number;
  readonly details?: string;
  readonly reason?: string;
  readonly chunkSizeBytes: number;
}

export type UploadDTO = InitiateCaseFileUploadDTO | CompleteCaseFileUploadDTO;
