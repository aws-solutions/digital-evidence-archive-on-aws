/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Entity, Model } from 'dynamodb-onetable';
import { DeaSchema } from './dea-schema';
import { deaTable } from './dea-table';

export type CaseType = Entity<typeof DeaSchema.models.Case>;
export const CaseModel: Model<CaseType> = deaTable.getModel('Case');

export type CaseUserType = Entity<typeof DeaSchema.models.CaseUser>;
export const CaseUserModel: Model<CaseUserType> = deaTable.getModel('CaseUser');

export type CaseFileType = Entity<typeof DeaSchema.models.CaseFile>;
export const CaseFileModel: Model<CaseFileType> = deaTable.getModel('CaseFile');

export type UserType = Entity<typeof DeaSchema.models.User>;
export const UserModel: Model<UserType> = deaTable.getModel('User');

export type StorageConfigType = Entity<typeof DeaSchema.models.StorageConfig>;
export const StorageConfigModel: Model<StorageConfigType> = deaTable.getModel('StorageConfig');

export interface CaseModelRepositoryProvider {
  CaseModel: Model<CaseType>;
}

export interface CaseUserModelRepositoryProvider {
  CaseUserModel: Model<CaseUserType>;
}

export interface CaseFileModelRepositoryProvider {
  CaseFileModel: Model<CaseFileType>;
}

export interface UserModelRepositoryProvider {
  UserModel: Model<UserType>;
}

export interface StorageConfigModelRepositoryProvider {
  StorageConfigModel: Model<StorageConfigType>;
}