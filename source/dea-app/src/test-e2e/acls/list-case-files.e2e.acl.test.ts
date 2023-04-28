/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';

const listCaseFilesArgs: argsType = [
  'listCaseFiles',
  [CaseAction.VIEW_FILES],
  `cases/${CASE_ID}/files`,
  'GET',
  undefined,
  false,
];

validateEndpointACLs(...listCaseFilesArgs);
