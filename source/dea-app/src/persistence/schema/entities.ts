/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Entity, Model, Table } from 'dynamodb-onetable';
import { DeaSchema } from './dea-schema';
import { deaTable } from './dea-table';

export type CaseType = Entity<typeof DeaSchema.models.Case>;
export const CaseModel: Model<CaseType> = deaTable.getModel('Case');

export type CaseUserType = Entity<typeof DeaSchema.models.CaseUser>;
export const CaseUserModel: Model<CaseUserType> = deaTable.getModel('CaseUser');

export type CaseFileType = Entity<typeof DeaSchema.models.CaseFile>;
export const CaseFileModel: Model<CaseFileType> = deaTable.getModel('CaseFile');

export type SessionType = Entity<typeof DeaSchema.models.Session>;
export const SessionModel: Model<SessionType> = deaTable.getModel('Session');

export type JobType = Entity<typeof DeaSchema.models.Job>;
export const JobModel: Model<JobType> = deaTable.getModel('Job');

export type UserType = Entity<typeof DeaSchema.models.User>;
export const UserModel: Model<UserType> = deaTable.getModel('User');

export type AuditJobType = Entity<typeof DeaSchema.models.AuditJob>;
export const AuditJobModel: Model<AuditJobType> = deaTable.getModel('AuditJob');

export interface CaseModelRepositoryProvider {
  CaseModel: Model<CaseType>;
}

export interface CaseUserModelRepositoryProvider {
  CaseUserModel: Model<CaseUserType>;
}

export interface CaseFileModelRepositoryProvider {
  CaseFileModel: Model<CaseFileType>;
}

export interface SessionModelRepositoryProvider {
  SessionModel: Model<SessionType>;
}

export interface JobModelRepositoryProvider {
  JobModel: Model<JobType>;
}

export interface UserModelRepositoryProvider {
  UserModel: Model<UserType>;
}

export interface AuditJobModelRepositoryProvider {
  AuditJobModel: Model<AuditJobType>;
}

export interface ModelRepositoryProvider
  extends CaseModelRepositoryProvider,
    CaseUserModelRepositoryProvider,
    CaseFileModelRepositoryProvider,
    SessionModelRepositoryProvider,
    JobModelRepositoryProvider,
    UserModelRepositoryProvider,
    AuditJobModelRepositoryProvider {
  table: Table;
}

export const defaultProvider: ModelRepositoryProvider = {
  table: deaTable,
  CaseModel: CaseModel,
  CaseUserModel: CaseUserModel,
  CaseFileModel: CaseFileModel,
  SessionModel: SessionModel,
  JobModel: JobModel,
  UserModel: UserModel,
  AuditJobModel: AuditJobModel,
};
