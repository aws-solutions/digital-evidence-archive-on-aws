/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { allButDisallowed } from '../../models/validation/joi-common';

const ulidMatch = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export const DeaSchema = {
  format: 'onetable:1.1.0',
  version: '0.1.0',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK', follow: false },
    GSI2: { hash: 'GSI2PK', sort: 'GSI2SK', follow: false },
  },
  models: {
    Case: {
      PK: { type: String, value: 'CASE#${ulid}#', required: true },
      SK: { type: String, value: 'CASE#', required: true },
      GSI1PK: { type: String, value: 'CASE#' },
      GSI1SK: { type: String, value: 'CASE#${lowerCaseName}#${ulid}#' },
      ulid: { type: String, generate: 'ulid', validate: ulidMatch, required: true },
      name: { type: String, required: true, unique: true, validate: allButDisallowed },
      lowerCaseName: { type: String, required: true, validate: allButDisallowed },
      status: { type: String, required: true, enum: Object.keys(CaseStatus) },
      description: { type: String, validate: allButDisallowed },
      objectCount: { type: Number },
      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
    CaseUser: {
      PK: { type: String, value: 'USER#${userUlid}#', required: true },
      SK: { type: String, value: 'CASE#${caseUlid}#', required: true },
      // gsi1 enable list all users for a case, sorted by firstName, lastName
      GSI1PK: { type: String, value: 'CASE#${caseUlid}#' },
      GSI1SK: { type: String, value: 'USER#${userFirstNameLower}#${userLastNameLower}#${userUlid}#' },
      // gsi2 enable list all cases for a user, sorted by case name
      GSI2PK: { type: String, value: 'USER#${userUlid}#' },
      GSI2SK: { type: String, value: 'CASE#${lowerCaseName}#' },
      caseUlid: { type: String, validate: ulidMatch, required: true },
      userUlid: { type: String, validate: ulidMatch, required: true },
      actions: { type: Array, items: { type: String, enum: Object.keys(CaseAction), required: true } },
      caseName: { type: String, required: true, validate: allButDisallowed },
      lowerCaseName: { type: String, required: true, validate: allButDisallowed },
      userFirstName: { type: String, required: true, validate: allButDisallowed },
      userLastName: { type: String, required: true, validate: allButDisallowed },
      userFirstNameLower: { type: String, required: true, validate: allButDisallowed },
      userLastNameLower: { type: String, required: true, validate: allButDisallowed },
      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
    CaseFile: {
      PK: { type: String, value: 'CASE#${caseUlid}#${preceedingDirectoryUlid}#', required: true },
      SK: { type: String, value: 'FILE#${fileName}#${ulid}', required: true },
      GSI1PK: { type: String, value: 'CASE#${caseUlid}#${ulid}#' },
      GSI1SK: { type: String, value: 'FILE#${isFile}#' },
      ulid: { type: String, generate: 'ulid', validate: ulidMatch, required: true },
      fileName: { type: String, required: true, validate: allButDisallowed },
      preceedingDirectoryUlid: { type: String, validate: ulidMatch },
      caseUlid: { type: String, validate: ulidMatch, required: true },
      isFile: { type: Boolean },
      contentPath: { type: String },
      uploadId: { type: String },
      sha256Hash: { type: String },
      fileType: { type: String },
      filePath: { type: String }, // whole s3 prefix within case dataset. ex: /meal/lunch/
      fileSizeMb: { type: Number },
      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
    User: {
      PK: { type: String, value: 'USER#${ulid}#', required: true },
      SK: { type: String, value: 'USER#', required: true },
      GSI1PK: { type: String, value: 'USER#' },
      GSI1SK: { type: String, value: 'USER#${lowerFirstName}#${lowerLastName}#${ulid}#' },
      // gsi2 determine if user is federated for the first time using the sub from the cognito token
      GSI2PK: { type: String, value: 'USER#${tokenId}#' },
      GSI2SK: { type: String, value: 'USER#' },
      ulid: { type: String, generate: 'ulid', validate: ulidMatch, required: true },
      tokenId: { type: String, required: true },
      firstName: { type: String, required: true, validate: allButDisallowed },
      lastName: { type: String, required: true, validate: allButDisallowed },
      lowerFirstName: { type: String, required: true, validate: allButDisallowed },
      lowerLastName: { type: String, required: true, validate: allButDisallowed },
      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};
