/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import useSWR from 'swr';
import { httpApiDelete, httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import {
  CompleteUploadForm,
  DownloadFileForm,
  DownloadFileResult,
  InitiateUploadForm,
} from '../models/CaseFiles';
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

enum QueryStatus {
  Cancelled = "Cancelled",
  Complete = "Complete",
  Failed = "Failed",
  Running = "Running",
  Scheduled = "Scheduled",
  Timeout = "Timeout",
  Unknown = "Unknown"
}

const progressStatus = [QueryStatus.Running, QueryStatus.Scheduled]
export interface DeaCaseAuditStatus {
  status: QueryStatus;
}

export interface DeaCaseAuditStartResponse {
  auditId: string;
}

interface CaseListReponse {
  cases: DeaCaseDTO[]
}

export const useListAllCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, isValidating } = useSWR(() => `cases/all-cases`, httpApiGet<CaseListReponse> );
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: isValidating };
};

export const useListMyCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, isValidating } = useSWR(() => `cases/my-cases`, (httpApiGet<CaseListReponse>) );
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: isValidating };
};

export const useGetCaseById = (id: string): DeaSingleResult<DeaCaseDTO | undefined> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/details`, httpApiGet<DeaCaseDTO>);
  return { data, isLoading: isValidating };
};

export const createCase = async (createCaseForm: CreateCaseForm): Promise<void> => {
  await httpApiPost(`cases`, { ...createCaseForm });
};

export const useListCaseFiles = (id: string, filePath = '/'): DeaListResult<DeaCaseFile> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/files?filePath=${filePath}`, httpApiGet<{files: DeaCaseFile[]}>);
  const caseFiles: DeaCaseFile[] = data?.files ?? [];
  return { data: caseFiles, isLoading: isValidating && !data };
};

export const initiateUpload = async (apiInput: InitiateUploadForm): Promise<DeaCaseFile> => {
  return httpApiPost(`cases/${apiInput.caseUlid}/files`, { ...apiInput });
};

export const completeUpload = async (apiInput: CompleteUploadForm): Promise<DeaCaseFile> => {
  return httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/contents`, { ...apiInput });
};

export const getPresignedUrl = async (apiInput: DownloadFileForm): Promise<DownloadFileResult> => {
  return httpApiGet(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/contents`, undefined);
};

export const useGetUsers = (nameBeginsWith: string): DeaListResult<DeaUser> => {
  const { data, isValidating } = useSWR(() => `users?nameBeginsWith=${nameBeginsWith}`, httpApiGet<{users: DeaUser[]}>);
  const users: DeaUser[] = data?.users ?? [];
  return { data: users, isLoading: isValidating };
};

export const addCaseMember = async (caseUserForm: CaseUserForm): Promise<void> => {
  await httpApiPost(`cases/${caseUserForm.caseUlid}/userMemberships`, { ...caseUserForm });
};

export const useGetCaseMembers = (id: string): DeaListResult<CaseUser> => {
  const { data, isValidating, mutate } = useSWR(() => `cases/${id}/userMemberships`, httpApiGet<{caseUsers: CaseUser[]}>);
  const cases: CaseUser[] = data?.caseUsers ?? [];
  return { data: cases, isLoading: isValidating, mutate };
};

export const removeCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiDelete(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};

export const updateCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiPut(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};

export const getCaseAuditCSV = async (caseId: string): Promise<string> => {
  const auditId = await startCaseAuditQuery(caseId);
  let auditResponse = await retrieveCaseAuditResult(caseId, auditId);
  let maxRetries = 60;
  while (typeof(auditResponse) !== 'string') {
    if (!progressStatus.includes(auditResponse.status) ||
        maxRetries === 0) {
      throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
    }
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveCaseAuditResult(caseId, auditId);
  }
  return auditResponse;
}

export const startCaseAuditQuery = async (caseId: string): Promise<string> => {
  const data: DeaCaseAuditStartResponse = await httpApiPost(`cases/${caseId}/audit`, undefined);
  return data.auditId;
}

export const retrieveCaseAuditResult = async (caseId: string, auditId: string): Promise<string | DeaCaseAuditStatus> => {
  return await httpApiGet(`cases/${caseId}/audit/${auditId}/csv`, undefined);
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useGetCaseActions = (id: string): DeaSingleResult<CaseUser | undefined> => {
  const { data, isValidating } = useSWR(() => `cases/${id}/actions`, httpApiGet<CaseUser>);
  return { data, isLoading: isValidating };
};