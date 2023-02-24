/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { validateEndpointACLs } from './case-api-acl-tester';
import { DeaHttpMethod } from './test-helpers';

type argsType = [string, CaseAction[], string, DeaHttpMethod, string?, boolean?];
const COMPANION_ID = '{companion}';
const CASE_ID = '{caseId}';
const RANDOM_STRING = '{rand}';

const getCaseDetailsArgs: argsType = [
  'getCaseDetailsACLs',
  [CaseAction.VIEW_CASE_DETAILS],
  `cases/${CASE_ID}`,
  'GET',
];
const putCaseDetailsArgs: argsType = [
  'putCaseDetailsACLs',
  [CaseAction.UPDATE_CASE_DETAILS],
  `cases/${CASE_ID}`,
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
const deleteMembershipArgs: argsType = [
  'removeFromCaseACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/userMemberships/${COMPANION_ID}`,
  'DELETE',
  undefined,
  true,
];
const putCaseUserArgs: argsType = [
  'putCaseUserACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/userMemberships/${COMPANION_ID}`,
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
    filePath: `/${RANDOM_STRING}/`,
    contentType: 'application/octet-stream',
    fileSizeMb: 1,
  }),
  true,
];

const listCaseFilesArgs: argsType = [
  'listCaseFiles',
  [CaseAction.VIEW_FILES],
  `cases/${CASE_ID}/files`,
  'GET',
  undefined,
  true,
];

describe('Case API ACL enforcement', () => {
  describe.each([
    getCaseDetailsArgs,
    putCaseDetailsArgs,
    inviteToCasesArgs,
    deleteMembershipArgs,
    putCaseUserArgs,
    initiateUploadCaseFileArgs,
    listCaseFilesArgs,
  ])('%s', validateEndpointACLs);
});
