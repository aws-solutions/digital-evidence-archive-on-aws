/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { validateEndpointACLs } from './case-api-acl-tester';
import { DeaHttpMethod } from './test-helpers';

type argsType = [string, CaseAction[], string, DeaHttpMethod, string?];
const getCaseDetailsArgs: argsType = [
  'getCaseDetailsACLs',
  [CaseAction.VIEW_CASE_DETAILS],
  'cases/{caseId}',
  'GET',
];
const putCaseDetailsArgs: argsType = [
  'putCaseDetailsACLs',
  [CaseAction.UPDATE_CASE_DETAILS],
  'cases/{caseId}',
  'PUT',
  JSON.stringify({
    ulid: '{caseId}',
    name: '{rand}',
    description: '{rand}',
  }),
];
const inviteToCasesArgs: argsType = [
  'inviteToCaseACLs',
  [CaseAction.INVITE],
  'cases/{caseId}/userMemberships',
  'POST',
  JSON.stringify({
    userUlid: '{companion}',
    caseUlid: '{caseId}',
    actions: [],
  }),
];
const deleteMembershipArgs: argsType = [
  'removeFromCaseACLs',
  [CaseAction.INVITE],
  'cases/{caseId}/userMemberships/{companion}',
  'DELETE',
  JSON.stringify({
    userUlid: '{companion}',
    caseUlid: '{caseId}',
    actions: [],
  }),
];

describe('Case API ACL enforcement', () => {
  describe.each([getCaseDetailsArgs, putCaseDetailsArgs, inviteToCasesArgs, deleteMembershipArgs])(
    '%s',
    validateEndpointACLs
  );
});
