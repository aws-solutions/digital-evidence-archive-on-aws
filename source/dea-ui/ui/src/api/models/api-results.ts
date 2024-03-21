/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaListResult<T> {
  data: T[];
  isLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate?: any;
}

export interface DeaSingleResult<T> {
  data: T;
  isLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate?: any;
}

export interface DeaFilesResponse<T> {
  files: T[];
  next: string;
}
