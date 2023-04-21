/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import sha256 from 'crypto-js/sha256';
import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';
const FILE_ID = '{fileId}';
const UPLOAD_ID = '{uploadId}';

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

validateEndpointACLs(...completeCaseFileUploadArgs);
