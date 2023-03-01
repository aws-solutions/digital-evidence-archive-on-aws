/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '@aws/dea-app';
import useSWR from 'swr';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';
import { CreateCaseForm } from '../models/Cases';

const useListAllCases = (): { cases: DeaCase[]; areCasesLoading: boolean } => {
  const { data, isValidating } = useSWR(() => `cases/all-cases`, httpApiGet);
  const cases: DeaCase[] = data?.cases ?? [];
  return { cases, areCasesLoading: isValidating };
};

const useGetCaseById = (id: string): { caseDetail: DeaCase; areCasesLoading: boolean } => {
  const { data, isValidating } = useSWR(() => `cases/${id}/`, httpApiGet);
  const caseDetail: DeaCase = data;
  return { caseDetail, areCasesLoading: isValidating };
};

const createCase = async (createCaseForm: CreateCaseForm): Promise<void> => {
  await httpApiPost(`cases`, { ...createCaseForm });
};

export { useListAllCases, useGetCaseById, createCase };
