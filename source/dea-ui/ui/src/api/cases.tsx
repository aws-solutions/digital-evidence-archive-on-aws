/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import useSWR from 'swr';
import { httpApiDelete, httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import { CompleteUploadForm, InitiateUploadForm } from '../models/CaseFiles';
import { CreateCaseForm } from '../models/Cases';
import { CaseUserForm } from '../models/CaseUser';
import { DeaCaseDTO } from './models/case';

export interface DeaListResult<T> {
  data: T[];
  isLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate?: any;
}

export interface DeaSingleResult<T> {
  data: T;
  isLoading: boolean;
}

export const useListAllCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, isValidating } = useSWR(() => `cases/all-cases`, httpApiGet);
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: isValidating };
};

export const useListMyCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, isValidating } = useSWR(() => `cases/my-cases`, httpApiGet);
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: isValidating };
};

export const useGetCaseById = (id: string): DeaSingleResult<DeaCaseDTO> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/details`, httpApiGet);
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
  return httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/contents`, { ...apiInput });
};

export const useGetUsers = (nameBeginsWith: string): DeaListResult<DeaUser> => {
  const { data, isValidating } = useSWR(() => `users?nameBeginsWith=${nameBeginsWith}`, httpApiGet);
  const users: DeaUser[] = data?.users ?? [];
  return { data: users, isLoading: isValidating };
};

export const addCaseMember = async (caseUserForm: CaseUserForm): Promise<void> => {
  await httpApiPost(`cases/${caseUserForm.caseUlid}/userMemberships`, { ...caseUserForm });
};

export const useGetCaseMembers = (id: string): DeaListResult<CaseUser> => {
  const { data, isValidating, mutate } = useSWR(() => `cases/${id}/userMemberships`, httpApiGet);
  const cases: CaseUser[] = data?.caseUsers ?? [];
  return { data: cases, isLoading: isValidating, mutate };
};

export const removeCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiDelete(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};

export const updateCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiPut(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};
