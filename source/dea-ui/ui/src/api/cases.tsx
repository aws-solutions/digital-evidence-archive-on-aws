/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { QueryExecutionState } from '@aws-sdk/client-athena';
import { DeaCase } from '@aws/dea-app/lib/models/case';
import { CaseFileDTO, DeaCaseFile, DeaCaseFileUpload } from '@aws/dea-app/lib/models/case-file';
import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import useSWR from 'swr';
import { httpApiDelete, httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import {
  CompleteUploadForm,
  DownloadFileForm,
  DownloadFileResult,
  InitiateUploadForm,
  RestoreFileForm,
} from '../models/CaseFiles';
import { CreateCaseForm, EditCaseForm, UpdateCaseStatusForm } from '../models/Cases';
import { CaseUserForm } from '../models/CaseUser';
import { useListDeaFiles } from './base';
import { DeaListResult, DeaSingleResult } from './models/api-results';
import { CaseOwnerDTO, DeaCaseDTO, ScopedDeaCaseDTO } from './models/case';

export const progressStatus = [QueryExecutionState.RUNNING.valueOf(), QueryExecutionState.QUEUED.valueOf()];

export interface AuditResult {
  status: QueryExecutionState | string;
  downloadUrl: string | undefined;
}

export interface DeaAuditStartResponse {
  auditId: string;
}

interface CaseListReponse {
  cases: DeaCaseDTO[];
}

export const useListAllCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, error } = useSWR(() => `cases/all-cases?limit=10000`, httpApiGet<CaseListReponse>);
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: !data && !error };
};

export const useListMyCases = (): DeaListResult<DeaCaseDTO> => {
  const { data, error, mutate } = useSWR(() => `cases/my-cases?limit=10000`, httpApiGet<CaseListReponse>);
  const cases: DeaCaseDTO[] = data?.cases ?? [];
  return { data: cases, isLoading: !data && !error, mutate };
};

export const useGetCaseById = (id: string): DeaSingleResult<DeaCaseDTO | undefined> => {
  const { data, error } = useSWR(() => `cases/${id}/details`, httpApiGet<DeaCaseDTO>);
  return { data, isLoading: !data && !error };
};

export const useGetFileDetailsById = (
  caseId: string,
  fileId: string
): DeaSingleResult<CaseFileDTO | undefined> => {
  const { data, error } = useSWR(() => `cases/${caseId}/files/${fileId}/info`, httpApiGet<CaseFileDTO>);
  return { data, isLoading: !data && !error };
};

export const useGetScopedCaseInfoById = (id: string): DeaSingleResult<ScopedDeaCaseDTO | undefined> => {
  const { data, error } = useSWR(() => `cases/${id}/scopedInformation`, httpApiGet<ScopedDeaCaseDTO>);
  return { data, isLoading: !data && !error };
};

export const createCase = async (createCaseForm: CreateCaseForm): Promise<DeaCase> => {
  return httpApiPost(`cases`, { ...createCaseForm });
};

export const updateCase = async (editCaseForm: EditCaseForm): Promise<void> => {
  await httpApiPut(`/cases/${editCaseForm.ulid}/details`, { ...editCaseForm });
};

export const useListCaseFiles = (id: string, filePath = '/'): DeaListResult<DeaCaseFile> => {
  return useListDeaFiles<DeaCaseFile>(`cases/${id}/files?filePath=${filePath}`);
};

export const initiateUpload = async (apiInput: InitiateUploadForm): Promise<DeaCaseFileUpload> => {
  return httpApiPost(`cases/${apiInput.caseUlid}/files`, { ...apiInput });
};

export const completeUpload = async (apiInput: CompleteUploadForm): Promise<DeaCaseFile> => {
  return httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/contents`, { ...apiInput });
};

export const getPresignedUrl = async (apiInput: DownloadFileForm): Promise<DownloadFileResult> => {
  return httpApiGet(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/contents`, undefined);
};

export const restoreFile = async (apiInput: RestoreFileForm): Promise<void> => {
  return httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}/restore`, undefined);
};

export const useGetUsers = (nameBeginsWith: string): DeaListResult<DeaUser> => {
  const { data, error } = useSWR(
    () => `users?nameBeginsWith=${nameBeginsWith}&limit=10000`,
    httpApiGet<{ users: DeaUser[] }>
  );
  const users: DeaUser[] = data?.users ?? [];
  return { data: users, isLoading: !data && !error };
};

export const addCaseMember = async (caseUserForm: CaseUserForm): Promise<void> => {
  await httpApiPost(`cases/${caseUserForm.caseUlid}/userMemberships`, { ...caseUserForm });
};

export const addCaseOwner = async (caseOwner: CaseOwnerDTO): Promise<void> => {
  await httpApiPost(`cases/${caseOwner.caseUlid}/owner`, { ...caseOwner });
};

export const useGetCaseMembers = (id: string): DeaListResult<CaseUser> => {
  const { data, error, mutate } = useSWR(
    () => `cases/${id}/userMemberships`,
    httpApiGet<{ caseUsers: CaseUser[] }>
  );
  const cases: CaseUser[] = data?.caseUsers ?? [];
  return { data: cases, isLoading: !error && !data, mutate };
};

export const removeCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiDelete(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};

export const updateCaseMember = async (caseUser: CaseUserForm): Promise<void> => {
  await httpApiPut(`cases/${caseUser.caseUlid}/users/${caseUser.userUlid}/memberships`, { ...caseUser });
};

export const updateCaseStatus = async (apiInput: UpdateCaseStatusForm): Promise<void> => {
  const { caseId, ...data } = apiInput;
  await httpApiPut(`cases/${caseId}/status`, data);
};

export const getCaseAuditCSV = async (caseId: string): Promise<string> => {
  const auditId = await startCaseAuditQuery(caseId);
  let auditResponse = await retrieveCaseAuditResult(caseId, auditId);
  let maxRetries = 60;
  while (progressStatus.includes(auditResponse.status.valueOf()) && maxRetries > 0) {
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveCaseAuditResult(caseId, auditId);
  }

  if (!auditResponse.downloadUrl) {
    throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
  }
  return auditResponse.downloadUrl;
};

export const startCaseAuditQuery = async (caseId: string): Promise<string> => {
  const data: DeaAuditStartResponse = await httpApiPost(`cases/${caseId}/audit`, undefined);
  return data.auditId;
};

export const retrieveCaseAuditResult = async (caseId: string, auditId: string): Promise<AuditResult> => {
  return await httpApiGet(`cases/${caseId}/audit/${auditId}/csv`, undefined);
};

export const getCaseFileAuditCSV = async (caseId: string, fileId: string): Promise<string> => {
  const auditId = await startCaseFileAuditQuery(caseId, fileId);
  let auditResponse = await retrieveCaseFileAuditResult(caseId, fileId, auditId);
  let maxRetries = 60;
  while (progressStatus.includes(auditResponse.status.valueOf()) && maxRetries > 0) {
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveCaseFileAuditResult(caseId, fileId, auditId);
  }

  if (!auditResponse.downloadUrl) {
    throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
  }
  return auditResponse.downloadUrl;
};

export const startCaseFileAuditQuery = async (caseId: string, fileId: string): Promise<string> => {
  const data: DeaAuditStartResponse = await httpApiPost(`cases/${caseId}/files/${fileId}/audit`, undefined);
  return data.auditId;
};

export const retrieveCaseFileAuditResult = async (
  caseId: string,
  fileId: string,
  auditId: string
): Promise<AuditResult> => {
  return await httpApiGet(`cases/${caseId}/files/${fileId}/audit/${auditId}/csv`, undefined);
};

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useGetCaseActions = (id: string): DeaSingleResult<CaseUser | undefined> => {
  const { data, error, mutate } = useSWR(() => `cases/${id}/actions`, httpApiGet<CaseUser>);
  return { data, isLoading: !data && !error, mutate };
};

export const getSystemAuditCSV = async (): Promise<string> => {
  const auditId = await startSystemAuditQuery();
  let auditResponse = await retrieveSystemAuditResult(auditId);
  let maxRetries = 60;
  while (progressStatus.includes(auditResponse.status.valueOf()) && maxRetries > 0) {
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveSystemAuditResult(auditId);
  }

  if (!auditResponse.downloadUrl) {
    throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
  }
  return auditResponse.downloadUrl;
};

export const startSystemAuditQuery = async (): Promise<string> => {
  const data: DeaAuditStartResponse = await httpApiPost(`system/audit`, undefined);
  return data.auditId;
};

export const retrieveSystemAuditResult = async (auditId: string): Promise<AuditResult> => {
  return await httpApiGet(`system/audit/${auditId}/csv`, undefined);
};
