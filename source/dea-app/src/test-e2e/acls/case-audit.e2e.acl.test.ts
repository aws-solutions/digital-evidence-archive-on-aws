/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../../models/case-action';
import { argsType, validateEndpointACLs } from '../resources/case-api-acl-tester';

const CASE_ID = '{caseId}';
const AUDIT_ID = '{auditId}';

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

validateEndpointACLs(...caseAuditArgs);
