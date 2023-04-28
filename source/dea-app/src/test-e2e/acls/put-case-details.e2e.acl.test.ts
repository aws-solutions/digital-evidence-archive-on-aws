/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';
const RANDOM_STRING = '{rand}';

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

validateEndpointACLs(...putCaseDetailsArgs);
