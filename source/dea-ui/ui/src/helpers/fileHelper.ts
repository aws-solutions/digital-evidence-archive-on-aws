/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

const KB = 1000;
const MB = 1000 ** 2;
const GB = 1000 ** 3;
const TB = 1000 ** 4;

export function formatFileSize(size: number): string {
  if (!size) {
    return '';
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
  readonly relativePath?: string;
}

export function toFileWithPath(file: FileWithPath, relativePath?: string): FileWithPath {
  const fileWithPath = file;
  const { webkitRelativePath } = file;
  Object.defineProperty(fileWithPath, 'relativePath', {
    value: webkitRelativePath || relativePath,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  return fileWithPath;
}
