/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';
const FILE_ID = '{fileId}';

const downloadCaseFileArgs: argsType = [
  'downloadCaseFileDetails',
  [CaseAction.DOWNLOAD],
  `cases/${CASE_ID}/files/${FILE_ID}/contents`,
  'POST',
  JSON.stringify({
    caseUlid: CASE_ID,
    ulid: FILE_ID,
    downloadReason: 'i want to test file download,',
  }),
  false,
  true,
  false,
  true,
];

validateEndpointACLs(...downloadCaseFileArgs);
