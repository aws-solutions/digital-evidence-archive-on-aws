/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '@aws/dea-app';
import useSWR from 'swr';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';
import { CreateCaseForm } from '../models/Cases';

const useCases = (): { cases: DeaCase[]; areCasesLoading: boolean } => {
  const { data, isValidating } = useSWR(() => 'cases', httpApiGet);
  const cases: DeaCase[] = data?.cases ?? [];
  return { cases, areCasesLoading: isValidating };
};

const createCase = async (createCaseForm: CreateCaseForm): Promise<void> => {
  await httpApiPost(`cases`, { ...createCaseForm });
};

export { useCases, createCase };
