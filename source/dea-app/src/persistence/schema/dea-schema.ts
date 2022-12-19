/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';

const ulidMatch = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

const STORAGE_TIERS = ['S3STANDARD', 'GLACIER_INSTANT', 'GLACIER_FLEX', 'GLACIER_DEEP'];

export const DeaSchema = {
  format: 'onetable:1.1.0',
  version: '0.1.0',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK', follow: false },
    GSI2: { hash: 'GSI2PK', sort: 'GSI2PK', follow: false },
  },
  models: {
    Case: {
      PK: { type: String, value: 'CASE#${ulid}#', required: true },
      SK: { type: String, value: 'CASE#', required: true },
      GSI1PK: { type: String, value: 'CASE#' },
      GSI1SK: { type: String, value: 'CASE#${lowerCaseName}#${ulid}#' },
      ulid: { type: String, unique: true, generate: 'ulid', validate: ulidMatch, required: true },
      name: { type: String, required: true, unique: true },
      lowerCaseName: { type: String, required: true },
      status: { type: String, required: true, enum: Object.keys(CaseStatus) },
      description: { type: String },
      objectCount: { type: Number, required: true },
    },
    CaseUser: {
      PK: { type: String, value: 'USER#${userUlid}#', required: true },
      SK: { type: String, value: 'CASE#${caseUlid}#', required: true },
      // gsi1 enable list all users for a case, sorted by firstName, lastName
      GSI1PK: { type: String, value: 'CASE#${caseUlid}#' },
      GSI1SK: { type: String, value: 'USER#${lowerFirstName}#${lowerLastName}#${userUlid}' },
      // gsi2 enable list all cases for a user, sorted by case name
      GSI2PK: { type: String, value: 'USER#${userUlid}#' },
      GSI2SK: { type: String, value: 'CASE#${lowerCaseName}#' },
      caseUlid: { type: String, validate: ulidMatch, required: true },
      userUlid: { type: String, validate: ulidMatch, required: true },
      actions: { type: Array, items: { type: String, enum: Object.keys(CaseAction), required: true } },
      caseName: { type: String, required: true },
      userFirstName: { type: String, required: true },
      userLastName: { type: String, required: true },
      userFirstNameLower: { type: String, required: true },
      userLastNameLower: { type: String, required: true },
    },
    CaseFile: {
      PK: { type: String, value: 'CASE#${caseUlid}#${preceedingDirectoryUlid}#', required: true },
      SK: { type: String, value: 'FILE#${name}#${ulid}', required: true },
      GSI1PK: { type: String, value: 'CASE#${caseUlid}#${ulid}#' },
      GSI1SK: { type: String, value: 'FILE#${isFile}#' },
      ulid: { type: String, generate: 'ulid', validate: ulidMatch },
      name: { type: String, required: true },
      preceedingDirectoryUlid: { type: String, validate: ulidMatch, required: true },
      isFile: { type: Boolean, required: false },
      contentPath: { type: String },
    },
    User: {
      PK: { type: String, value: 'USER#${ulid}#', required: true },
      SK: { type: String, value: 'USER#', required: true },
      GSI1PK: { type: String, value: 'USER#' },
      GSI1SK: { type: String, value: 'USER#${lowerFirstName}#${lowerLastName}#${ulid}#' },
      ulid: { type: String, generate: 'ulid', validate: ulidMatch, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      lowerFirstName: { type: String, required: true },
      lowerLastName: { type: String, required: true },
    },
    StorageConfig: {
      PK: { type: String, value: 'CONFIG#', required: true },
      SK: { type: String, value: 'STORAGECONFIG#', required: true },
      activeStorage: { type: String, required: true, enum: STORAGE_TIERS },
      archiveStorage: { type: String, required: true, enum: STORAGE_TIERS },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};
