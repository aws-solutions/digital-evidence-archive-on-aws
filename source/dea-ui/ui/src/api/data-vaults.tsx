/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAssociationDTO, DeaCaseFile, RemoveCaseAssociationDTO } from '@aws/dea-app/lib/models/case-file';
import { DeaDataSyncTask } from '@aws/dea-app/lib/models/data-sync-task';
import { DeaDataVault, DeaDataVaultInput } from '@aws/dea-app/lib/models/data-vault';
import { DataVaultExecutionDTO, DeaDataVaultExecution } from '@aws/dea-app/lib/models/data-vault-execution';
import { DeaDataVaultFile } from '@aws/dea-app/lib/models/data-vault-file';
import { DataVaultTaskDTO, DeaDataVaultTask } from '@aws/dea-app/lib/models/data-vault-task';
import useSWR from 'swr';
import { httpApiDelete, httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import { useDeaListResponse, useListDeaFiles } from './base';
import { AuditResult, DeaAuditStartResponse, delay, progressStatus } from './cases';
import { DeaListResult, DeaSingleResult } from './models/api-results';

interface DataVaultListReponse {
  dataVaults: DeaDataVault[];
}

interface DataSyncTaskListReponse {
  dataSyncTasks: DeaDataSyncTask[];
  next: string;
}

export const useListAllDataVaults = (): DeaListResult<DeaDataVault> => {
  const { data, error } = useSWR(() => `datavaults?limit=10000`, httpApiGet<DataVaultListReponse>);
  const dataVaults: DeaDataVault[] = data?.dataVaults ?? [];
  return { data: dataVaults, isLoading: !data && !error };
};

export const createDataVault = async (createDataVaultInput: DeaDataVaultInput): Promise<DeaDataVault> => {
  return httpApiPost(`datavaults`, { ...createDataVaultInput });
};

export const useGetDataVaultById = (id: string): DeaSingleResult<DeaDataVault | undefined> => {
  const { data, error } = useSWR(() => `datavaults/${id}/details`, httpApiGet<DeaDataVault>);
  return { data, isLoading: !data && !error };
};

export const updateDataVault = async (updateDataVault: DeaDataVault): Promise<DeaDataVault> => {
  const { ulid, name, description } = updateDataVault;
  return httpApiPut(`datavaults/${updateDataVault.ulid}/details`, { ulid, name, description });
};

export const useListAllDataSyncTasks = (): DeaListResult<DeaDataSyncTask> => {
  return useDeaListResponse<DataSyncTaskListReponse, DeaDataSyncTask, 'dataSyncTasks'>(
    `datasync/tasks`,
    'dataSyncTasks'
  );
};

export const createDataVaultExecution = async (
  taskId: string,
  dataVaultExecutionDTO: DataVaultExecutionDTO
): Promise<DeaDataVaultExecution> => {
  return httpApiPost(`datavaults/tasks/${taskId}/executions`, { ...dataVaultExecutionDTO });
};

export const createDataVaultTask = async (
  dataVaultId: string,
  task: DataVaultTaskDTO
): Promise<DeaDataVaultTask> => {
  return httpApiPost(`datavaults/${dataVaultId}/tasks`, { ...task });
};

export const useListDataVaultFiles = (id: string, filePath = '/'): DeaListResult<DeaDataVaultFile> => {
  return useListDeaFiles<DeaDataVaultFile>(`datavaults/${id}/files?filePath=${filePath}`);
};

export const useGetDataVaultFileDetailsById = (
  dataVaultId: string,
  fileId: string
): DeaSingleResult<DeaDataVaultFile | undefined> => {
  const { data, error, mutate } = useSWR(
    () => `datavaults/${dataVaultId}/files/${fileId}/info`,
    httpApiGet<DeaDataVaultFile>
  );
  return { data, isLoading: !data && !error, mutate };
};

export const createDataVaultFileAssociation = async (
  dataVaultId: string,
  caseAssociationDTO: CaseAssociationDTO
): Promise<DeaCaseFile[]> => {
  return httpApiPost(`datavaults/${dataVaultId}/caseAssociations`, { ...caseAssociationDTO });
};

export const removeDataVaultFileCaseAssociation = async (
  dataVaultId: string,
  fileId: string,
  removeCaseAssociationDTO: RemoveCaseAssociationDTO
): Promise<void> => {
  await httpApiDelete(`datavaults/${dataVaultId}/files/${fileId}/caseAssociations`, {
    ...removeCaseAssociationDTO,
  });
};

export const getDataVaultAuditCSV = async (dataVaultId: string): Promise<string> => {
  const auditId = await startDataVaultAuditQuery(dataVaultId);
  let auditResponse = await retrieveDataVaultAuditResult(dataVaultId, auditId);
  let maxRetries = 60;
  while (progressStatus.includes(auditResponse.status.valueOf()) && maxRetries > 0) {
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveDataVaultAuditResult(dataVaultId, auditId);
  }

  if (!auditResponse.downloadUrl) {
    throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
  }
  return auditResponse.downloadUrl;
};

export const startDataVaultAuditQuery = async (dataVaultId: string): Promise<string> => {
  const data: DeaAuditStartResponse = await httpApiPost(`datavaults/${dataVaultId}/audit`, undefined);
  return data.auditId;
};

export const retrieveDataVaultAuditResult = async (
  dataVaultId: string,
  auditId: string
): Promise<AuditResult> => {
  return await httpApiGet(`datavaults/${dataVaultId}/audit/${auditId}/csv`, undefined);
};

export const getDataVaultFileAuditCSV = async (dataVaultId: string, fileId: string): Promise<string> => {
  const auditId = await startDataVaultFileAuditQuery(dataVaultId, fileId);
  let auditResponse = await retrieveDataVaultFileAuditResult(dataVaultId, fileId, auditId);
  let maxRetries = 60;
  while (progressStatus.includes(auditResponse.status.valueOf()) && maxRetries > 0) {
    --maxRetries;
    await delay(1000);
    auditResponse = await retrieveDataVaultFileAuditResult(dataVaultId, fileId, auditId);
  }

  if (!auditResponse.downloadUrl) {
    throw new Error(`Audit request was empty or experienced a failure. Status: ${auditResponse.status}`);
  }
  return auditResponse.downloadUrl;
};

export const startDataVaultFileAuditQuery = async (dataVaultId: string, fileId: string): Promise<string> => {
  const data: DeaAuditStartResponse = await httpApiPost(
    `datavaults/${dataVaultId}/files/${fileId}/audit`,
    undefined
  );
  return data.auditId;
};

export const retrieveDataVaultFileAuditResult = async (
  dataVaultId: string,
  fileId: string,
  auditId: string
): Promise<AuditResult> => {
  return await httpApiGet(`datavaults/${dataVaultId}/files/${fileId}/audit/${auditId}/csv`, undefined);
};
