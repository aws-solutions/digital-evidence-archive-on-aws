/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

export function formatFileSize(size: number): string {
  if (!size) {
    return '-';
  }
  if (size < MB) {
    return `${(size / KB).toFixed(2)} KB`;
  }
  if (size < GB) {
    return `${(size / MB).toFixed(2)} MB`;
  }
  if (size < TB) {
    return `${(size / GB).toFixed(2)} GB`;
  }
  return `${(size / TB).toFixed(2)} TB`;
}

export interface FileWithPath extends File {
  readonly relativePath: string;
}

export function toFileWithPath(file: File, relativePath: string): FileWithPath {
  const fileWithPath = file;
  Object.defineProperty(fileWithPath, 'relativePath', {
    value: relativePath,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return fileWithPath as FileWithPath;
}

export function removeFileNameFromPath(localPath: string): string {
  if (!localPath) {
    return '/';
  }
  return `/${localPath.substring(0, localPath.lastIndexOf('/') + 1)}`;
}
