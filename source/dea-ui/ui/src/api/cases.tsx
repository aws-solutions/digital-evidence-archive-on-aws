/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '@aws/dea-app';
import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import useSWR from 'swr';
import { httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import { CompleteUploadForm, InitiateUploadForm } from '../models/CaseFiles';
import { CreateCaseForm } from '../models/Cases';

export interface DeaListResult<T> {
  data: T[];
  isLoading: boolean;
}

export interface DeaSingleResult<T> {
  data: T;
  isLoading: boolean;
}

export const useListAllCases = (): DeaListResult<DeaCase> => {
  const { data, isValidating } = useSWR(() => `cases/all-cases`, httpApiGet);
  const cases: DeaCase[] = data?.cases ?? [];
  return { data: cases, isLoading: isValidating };
};

export const useGetCaseById = (id: string): DeaSingleResult<DeaCase> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/`, httpApiGet);
  return { data, isLoading: isValidating };
};

export const createCase = async (createCaseForm: CreateCaseForm): Promise<void> => {
  await httpApiPost(`cases`, { ...createCaseForm });
};

export const useListCaseFiles = (id: string, filePath = '/'): DeaListResult<DeaCaseFile> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/files?filePath=${filePath}`, httpApiGet);
  const caseFiles: DeaCaseFile[] = data?.cases ?? [];
  return { data: caseFiles, isLoading: isValidating && !data };
};

export const initiateUpload = async (apiInput: InitiateUploadForm): Promise<DeaCaseFile> => {
  return httpApiPost(`cases/${apiInput.caseUlid}/files`, { ...apiInput });
};

export const completeUpload = async (apiInput: CompleteUploadForm): Promise<DeaCaseFile> => {
  return httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}`, { ...apiInput });
};
