/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';
const RANDOM_STRING = '{rand}';

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
    fileSizeMb: 1,
  }),
  false,
];

validateEndpointACLs(...initiateUploadCaseFileArgs);
