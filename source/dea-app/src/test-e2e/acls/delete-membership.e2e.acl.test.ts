/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const COMPANION_ID = '{companion}';
const CASE_ID = '{caseId}';

const deleteMembershipArgs: argsType = [
  'removeFromCaseACLs',
  [CaseAction.INVITE],
  `cases/${CASE_ID}/users/${COMPANION_ID}/memberships`,
  'DELETE',
  undefined,
  true,
];

validateEndpointACLs(...deleteMembershipArgs);
