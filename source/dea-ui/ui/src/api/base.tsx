/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import useSWRInfinite from 'swr/infinite';
import { httpApiGet } from '../helpers/apiHelper';
import { DeaListResult, DeaFilesResponse } from './models/api-results';

export function useListDeaFiles<T>(url: string, pageSize = 5000): DeaListResult<T> {
  const { data, error } = useSWRInfinite<DeaFilesResponse<T>>(
    (pageIndex, previousPageData) => {
      // reached the end
      if (previousPageData && !previousPageData.next) {
        return null;
      }

      // first page, we don't have `previousPageData`
      if (pageIndex === 0 || !previousPageData) {
        return `${url}&limit=${pageSize}`;
      }

      // add the cursor to the API endpoint
      const encodedNext = encodeURIComponent(previousPageData.next);
      return `${url}&limit=${pageSize}&next=${encodedNext}`;
    },
    httpApiGet<DeaFilesResponse<T>>,
    { initialSize: 100000 }
  );
  const files: T[] = data?.flatMap((page) => page.files) ?? [];
  return { data: files, isLoading: !error && !data };
}
