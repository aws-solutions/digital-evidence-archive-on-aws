/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import useSWRInfinite from 'swr/infinite';
import { httpApiGet } from '../helpers/apiHelper';
import { DeaListResult, DeaFilesResponse } from './models/api-results';

export type KeysOfType<T, KT> = {
  [K in keyof T]: T[K] extends KT ? K : never;
}[keyof T];

export function useListDeaFiles<T>(url: string, pageSize = 5000, initialSize = 100000): DeaListResult<T> {
  return useDeaListResponse<DeaFilesResponse<T>, T, 'files'>(url, 'files', pageSize, initialSize);
}

export function useDeaListResponse<R, T, K extends KeysOfType<R, T[]>>(
  url: string,
  key: K,
  pageSize = 100,
  initialSize = 500
): DeaListResult<T> {
  const queryStringSeparator = url.includes('?') ? '&' : '?';
  const { data, error } = useSWRInfinite<R>(
    (pageIndex, previousPageData) => {
      // reached the end
      if (previousPageData && !previousPageData.next) {
        return null;
      }

      // first page, we don't have `previousPageData`
      if (pageIndex === 0 || !previousPageData) {
        return `${url}${queryStringSeparator}limit=${pageSize}`;
      }

      // add the cursor to the API endpoint
      const encodedNext = encodeURIComponent(previousPageData.next);
      return `${url}${queryStringSeparator}limit=${pageSize}&next=${encodedNext}`;
    },
    httpApiGet<R>,
    { initialSize }
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const items = data?.flatMap((page) => page[key] as T[]) ?? [];
  return { data: items, isLoading: !error && !data };
}
