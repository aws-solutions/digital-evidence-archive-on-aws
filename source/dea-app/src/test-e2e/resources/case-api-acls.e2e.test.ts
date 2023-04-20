/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import sha256 from 'crypto-js/sha256';
import { CaseAction } from '../../models/case-action';
import { validateEndpointACLs } from './case-api-acl-tester';
import { DeaHttpMethod } from './test-helpers';

type argsType = [
  string /* testSuiteName */,
  CaseAction[] /* requiredActions */,
  string /* urlPath */,
  DeaHttpMethod /* httpMethod */,
  string? /* data */,
  boolean? /* createCompanionMemberships */,
  boolean? /* testRequiresOwnerCaseFile */,
  boolean? /* testRequiresUserCaseFile */,
  boolean? /* testRequiresDownload */,
  boolean? /* testRequiresAuditId */
];

const COMPANION_ID = '{companion}';
const CASE_ID = '{caseId}';
const AUDIT_ID = '{auditId}';
const FILE_ID = '{fileId}';
const UPLOAD_ID = '{uploadId}';
const RANDOM_STRING = '{rand}';

const getCaseDetailsArgs: argsType = [
  'getCaseDetailsACLs',
  [CaseAction.VIEW_CASE_DETAILS],
  `cases/${CASE_ID}/details`,
  'GET',
];
const putCaseDetailsArgs: argsType = [
  'putCaseDetailsACLs',
  [CaseAction.UPDATE_CASE_DETAILS],
  `cases/${CASE_ID}/details`,
  'PUT',
  JSON.stringify({
    ulid: CASE_ID,
    name: RANDOM_STRING,
    description: RANDOM_STRING,
  }),
];
const inviteToCasesArgs: argsType = [
  'inviteToCaseACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/userMemberships`,
  'POST',
  JSON.stringify({
    userUlid: COMPANION_ID,
    caseUlid: CASE_ID,
    actions: [],
  }),
];
const getCaseCollabsArgs: argsType = [
  'getCaseCollaborators',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/userMemberships`,
  'GET',
  undefined,
  false,
  false,
  false,
  true,
];
const deleteMembershipArgs: argsType = [
  'removeFromCaseACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/users/${COMPANION_ID}/memberships`,
  'DELETE',
  undefined,
  true,
];
const putCaseUserArgs: argsType = [
  'putCaseUserACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/users/${COMPANION_ID}/memberships`,
  'PUT',
  JSON.stringify({
    userUlid: COMPANION_ID,
    caseUlid: CASE_ID,
    actions: [CaseAction.DOWNLOAD],
  }),
  true,
];
const initiateUploadCaseFileArgs: argsType = [
  'initiateUploadCaseFile',
  [CaseAction.UPLOAD],
  `cases/${CASE_ID}/files`,
  'POST',
  JSON.stringify({
    caseUlid: CASE_ID,
    fileName: RANDOM_STRING,
    filePath: `/`,
    contentType: 'application/octet-stream',
    fileSizeBytes: 1,
  }),
  false,
];
const listCaseFilesArgs: argsType = [
  'listCaseFiles',
  [CaseAction.VIEW_FILES],
  `cases/${CASE_ID}/files`,
  'GET',
  undefined,
  false,
];
const getCaseFileDetailsArgs: argsType = [
  'getCaseFileDetails',
  [CaseAction.VIEW_FILES],
  `cases/${CASE_ID}/files/${FILE_ID}/info`,
  'GET',
  undefined,
  false,
  true,
];
const completeCaseFileUploadArgs: argsType = [
  'completeCaseFileUpload',
  [CaseAction.UPLOAD],
  `cases/${CASE_ID}/files/${FILE_ID}/contents`,
  'PUT',
  JSON.stringify({
    caseUlid: CASE_ID,
    ulid: FILE_ID,
    uploadId: UPLOAD_ID,
    sha256Hash: sha256('hello world').toString(),
  }),
  false,
  true,
  true,
];
const downloadCaseFileArgs: argsType = [
  'downloadCaseFileDetails',
  [CaseAction.DOWNLOAD],
  `cases/${CASE_ID}/files/${FILE_ID}/contents`,
  'GET',
  undefined,
  false,
  true,
  false,
  true,
];
const caseAuditQueryArgs: argsType = [
  'startCaseAuditQuery',
  [CaseAction.CASE_AUDIT],
  `cases/${CASE_ID}/audit`,
  'POST',
  undefined,
];
const caseAuditArgs: argsType = [
  'getCaseAudit',
  [CaseAction.CASE_AUDIT],
  `cases/${CASE_ID}/audit/${AUDIT_ID}/csv`,
  'GET',
  undefined,
  false,
  false,
  false,
  false,
  true,
];

describe('Case API ACL enforcement', () => {
  describe.each([
    getCaseDetailsArgs,
    putCaseDetailsArgs,
    inviteToCasesArgs,
    getCaseCollabsArgs,
    deleteMembershipArgs,
    putCaseUserArgs,
    initiateUploadCaseFileArgs,
    listCaseFilesArgs,
    completeCaseFileUploadArgs,
    getCaseFileDetailsArgs,
    downloadCaseFileArgs,
    caseAuditQueryArgs,
    caseAuditArgs,
  ])('%s', validateEndpointACLs);
});
