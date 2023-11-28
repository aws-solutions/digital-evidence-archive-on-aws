/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase, MyCase } from '../models/case';
import { DeaCaseFileResult } from '../models/case-file';
import {
  CaseType,
  CaseUserType,
  SessionType,
  UserType,
  CaseFileType,
  JobType,
  DataVaultType,
  DataVaultTaskType,
  DataVaultExecutionType,
  DataVaultFileType,
} from '../persistence/schema/entities';
import { CaseAction } from './case-action';
import { CaseFileStatus } from './case-file-status';
import { CaseStatus } from './case-status';
import { CaseUser } from './case-user';
import { DeaDataVault } from './data-vault';
import { DeaDataVaultExecution } from './data-vault-execution';
import { DeaDataVaultFile } from './data-vault-file';
import { DeaDataVaultTask } from './data-vault-task';
import { Job } from './job';
import { DeaSession } from './session';
import { DeaUser } from './user';

export const caseFromEntity = (caseEntity: CaseType): DeaCase => {
  return {
    ulid: caseEntity.ulid,
    name: caseEntity.name,
    description: caseEntity.description,
    objectCount: caseEntity.objectCount,
    totalSizeBytes: caseEntity.totalSizeBytes,
    // status schema is defined with CaseStatus so we can safely cast here
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    status: caseEntity.status as CaseStatus,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    filesStatus: caseEntity.filesStatus as CaseFileStatus,
    s3BatchJobId: caseEntity.s3BatchJobId,
    created: caseEntity.created,
    updated: caseEntity.updated,
  };
};

export const dataVaultFromEntity = (dataVaultEntity: DataVaultType): DeaDataVault => {
  return {
    ulid: dataVaultEntity.ulid,
    name: dataVaultEntity.name,
    description: dataVaultEntity.description,
    objectCount: dataVaultEntity.objectCount,
    totalSizeBytes: dataVaultEntity.totalSizeBytes,
    created: dataVaultEntity.created,
    updated: dataVaultEntity.updated,
  };
};

export const dataVaultTaskFromEntity = (dataVaultTaskEntity: DataVaultTaskType): DeaDataVaultTask => {
  return {
    taskId: dataVaultTaskEntity.taskId,
    dataVaultUlid: dataVaultTaskEntity.dataVaultUlid,
    name: dataVaultTaskEntity.name,
    description: dataVaultTaskEntity.description,
    sourceLocationArn: dataVaultTaskEntity.sourceLocationArn,
    destinationLocationArn: dataVaultTaskEntity.destinationLocationArn,
    taskArn: dataVaultTaskEntity.taskArn,
    deleted: dataVaultTaskEntity.deleted,
  };
};

export const dataVaultExecutionFromEntity = (
  dataVaultExecutionEntity: DataVaultExecutionType
): DeaDataVaultExecution => {
  return {
    executionId: dataVaultExecutionEntity.executionId,
    taskId: dataVaultExecutionEntity.taskId,
    created: dataVaultExecutionEntity.created,
    createdBy: dataVaultExecutionEntity.createdBy,
  };
};

export const dataVaultFileFromEntity = (dataVaultFileEntity: DataVaultFileType): DeaDataVaultFile => {
  return {
    ulid: dataVaultFileEntity.ulid,
    fileName: dataVaultFileEntity.fileName,
    filePath: dataVaultFileEntity.filePath,
    dataVaultUlid: dataVaultFileEntity.dataVaultUlid,
    isFile: dataVaultFileEntity.isFile,
    fileSizeBytes: dataVaultFileEntity.fileSizeBytes,
    contentType: dataVaultFileEntity.contentType,
    createdBy: dataVaultFileEntity.createdBy,
    sha256Hash: dataVaultFileEntity.sha256Hash,
    versionId: dataVaultFileEntity.versionId,
    executionId: dataVaultFileEntity.executionId,
    fileS3Key: dataVaultFileEntity.fileS3Key,
    created: dataVaultFileEntity.created,
    updated: dataVaultFileEntity.updated,
    caseCount: dataVaultFileEntity.caseCount,
  };
};

export const myCaseFromEntityAndActionsMap = (
  caseEntity: CaseType,
  actionsMap: Map<string, CaseAction[]>
): MyCase => {
  return {
    ulid: caseEntity.ulid,
    name: caseEntity.name,
    description: caseEntity.description,
    objectCount: caseEntity.objectCount,
    totalSizeBytes: caseEntity.totalSizeBytes,
    // status schema is defined with CaseStatus so we can safely cast here
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    status: caseEntity.status as CaseStatus,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    filesStatus: caseEntity.filesStatus as CaseFileStatus,
    s3BatchJobId: caseEntity.s3BatchJobId,
    actions: actionsMap.get(caseEntity.ulid) ?? [],
    created: caseEntity.created,
    updated: caseEntity.updated,
  };
};

export const sessionFromEntity = (sessionEntity: SessionType): DeaSession => {
  return {
    userUlid: sessionEntity.userUlid,
    tokenId: sessionEntity.tokenId,
    ttl: sessionEntity.ttl,
    isRevoked: sessionEntity.isRevoked,
    created: sessionEntity.created,
    updated: sessionEntity.updated,
  };
};

export const userFromEntity = (userEntity: UserType): DeaUser => {
  return {
    ulid: userEntity.ulid,
    tokenId: userEntity.tokenId,
    idPoolId: userEntity.idPoolId,
    firstName: userEntity.firstName,
    lastName: userEntity.lastName,
    created: userEntity.created,
    updated: userEntity.updated,
  };
};

export const caseUserFromEntity = (caseUserEntity: CaseUserType): CaseUser => {
  return {
    caseUlid: caseUserEntity.caseUlid,
    userUlid: caseUserEntity.userUlid,
    userFirstName: caseUserEntity.userFirstName,
    userLastName: caseUserEntity.userLastName,
    caseName: caseUserEntity.caseName,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    actions: caseUserEntity.actions?.map((action) => action as CaseAction) ?? [],
    created: caseUserEntity.created,
    updated: caseUserEntity.updated,
  };
};

export const caseFileFromEntity = (caseFileEntity: CaseFileType): DeaCaseFileResult => {
  return {
    ulid: caseFileEntity.ulid,
    caseUlid: caseFileEntity.caseUlid,
    fileName: caseFileEntity.fileName,
    contentType: caseFileEntity.contentType,
    createdBy: caseFileEntity.createdBy,
    filePath: caseFileEntity.filePath,
    fileSizeBytes: caseFileEntity.fileSizeBytes,
    uploadId: caseFileEntity.uploadId,
    sha256Hash: caseFileEntity.sha256Hash,
    versionId: caseFileEntity.versionId,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    status: caseFileEntity.status as CaseFileStatus,
    created: caseFileEntity.created,
    updated: caseFileEntity.updated,
    isFile: caseFileEntity.isFile,
    ttl: caseFileEntity.ttl,
    reason: caseFileEntity.reason,
    details: caseFileEntity.details,
    // if fileS3Key is set returns their value. Otherwise, fileS3Key value comes from the <caseUlid,ulid> tupple.
    fileS3Key: caseFileEntity.fileS3Key ?? `${caseFileEntity.caseUlid}/${caseFileEntity.ulid}`,
    dataVaultUlid: caseFileEntity.dataVaultUlid,
    executionId: caseFileEntity.executionId,
    associationCreatedBy: caseFileEntity.associationCreatedBy,
    associationDate: caseFileEntity.associationDate,
    dataVaultUploadDate: caseFileEntity.dataVaultUploadDate,
  };
};

export const jobFromEntity = (jobEntity: JobType): Job => {
  return {
    jobId: jobEntity.jobId,
    caseUlid: jobEntity.caseUlid,
    updated: jobEntity.updated,
    created: jobEntity.created,
  };
};
