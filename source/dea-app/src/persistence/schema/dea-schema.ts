/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { allButDisallowed, ulidRegex, filePathSafeCharsRegex } from '../../models/validation/joi-common';

const DEFAULT_SESSION_TTL_TIME_ADDITION_SECONDS = 43200; // 12 hours (e.g. expiry of the refresh token)

export enum AuditType {
  CASE = 'CASE',
  CASEFILE = 'CASEFILE',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

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
      ulid: { type: String, generate: 'ulid', validate: ulidRegex, required: true },
      name: { type: String, required: true, unique: true, validate: allButDisallowed },
      lowerCaseName: { type: String, required: true, validate: allButDisallowed },
      status: { type: String, required: true, enum: Object.keys(CaseStatus) },
      description: { type: String, validate: allButDisallowed },
      objectCount: { type: Number, required: true, default: 0 },
      totalSizeBytes: { type: Number, required: true, default: 0 },
      filesStatus: { type: String, required: true, enum: Object.keys(CaseFileStatus) },
      s3BatchJobId: { type: String },
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
      caseUlid: { type: String, validate: ulidRegex, required: true },
      userUlid: { type: String, validate: ulidRegex, required: true },
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
      // Get file or folder by ulid
      PK: { type: String, value: 'CASE#${caseUlid}#', required: true },
      SK: { type: String, value: 'FILE#${ulid}#', required: true },

      // For UI folder navigation. Get all files and folders in given folder path
      GSI1PK: { type: String, value: 'CASE#${caseUlid}#${filePath}#', required: true },
      GSI1SK: { type: String, value: 'FILE#${fileName}#', required: true },

      // Get specific file or folder by full path
      GSI2PK: {
        type: String,
        value: 'CASE#${caseUlid}#${filePath}${fileName}#',
        required: true,
        unique: true,
      },
      GSI2SK: { type: String, value: 'FILE#${isFile}#', required: true },

      ulid: { type: String, generate: 'ulid', validate: ulidRegex, required: true },
      fileName: { type: String, required: true, validate: allButDisallowed },
      filePath: { type: String, required: true, validate: filePathSafeCharsRegex }, // relative path at upload time.
      caseUlid: { type: String, validate: ulidRegex, required: true },
      createdBy: { type: String, validate: ulidRegex, required: true },
      isFile: { type: Boolean, required: true },
      fileSizeBytes: { type: Number, required: true },
      status: { type: String, required: true, enum: Object.keys(CaseFileStatus) },
      ttl: { ttl: true, type: Number },
      uploadId: { type: String },
      versionId: { type: String },
      sha256Hash: { type: String },
      contentType: { type: String },
      details: { type: String, validate: allButDisallowed },
      reason: { type: String, validate: allButDisallowed },
      fileS3Key: { type: String },

      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
    Session: {
      PK: { type: String, value: 'USER#${userUlid}#', required: true },
      SK: { type: String, value: 'SESSION#${tokenId}#', required: true },
      userUlid: { type: String, validate: ulidRegex, required: true },
      // the tokenId here is separate from the User tokenId.
      // the User tokenId is the "sub" field from the id token and is
      // used to determine whether the user is a first time federated user
      // this tokenId is the jti of the id token and is a unique identifier
      tokenId: { type: String, required: true, unique: true },
      ttl: {
        ttl: true,
        type: Number,
        default: () => {
          return Math.floor(Date.now() / 1000 + DEFAULT_SESSION_TTL_TIME_ADDITION_SECONDS);
        },
        required: true,
      },
      isRevoked: { type: Boolean, required: true },
      created: { type: Date },
      updated: { type: Date },
    },
    Job: {
      PK: { type: String, value: 'JOB#${jobId}#', required: true },
      SK: { type: String, value: 'JOB#', required: true },
      GSI1PK: { type: String, value: 'CASE#' },
      GSI1SK: { type: String, value: 'CASE#${lowerCaseName}#${ulid}#' },
      jobId: { type: String, required: true },
      caseUlid: { type: String, validate: ulidRegex, required: true },
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
      ulid: { type: String, generate: 'ulid', validate: ulidRegex, required: true },
      // The following is the sub field from the identity token for the user
      // is guaranteed to unique per user. This field is used to determine
      // whether or not user has already been added to the DB
      tokenId: { type: String, required: true, unique: true },
      // The identity id given by the Cognito Identity Pool is unique per user
      // and will be checked for each API to make sure that the person described
      // by the id token, and who the IAM credentials were granted are the same person
      idPoolId: { type: String, unique: true },
      firstName: { type: String, required: true, validate: allButDisallowed },
      lastName: { type: String, required: true, validate: allButDisallowed },
      lowerFirstName: { type: String, required: true, validate: allButDisallowed },
      lowerLastName: { type: String, required: true, validate: allButDisallowed },
      //managed by onetable - but included for entity generation
      created: { type: Date },
      updated: { type: Date },
    },
    AuditJob: {
      PK: { type: String, value: 'AUDIT#${ulid}#', required: true },
      SK: { type: String, value: '${auditType}#${resourceId}#' },
      ulid: { type: String, generate: 'ulid', validate: ulidRegex, required: true },
      queryId: { type: String, required: true },
      resourceId: { type: String, required: true },
      auditType: { type: String, required: true, enum: Object.keys(AuditType) },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
    ttl: true,
  },
};
