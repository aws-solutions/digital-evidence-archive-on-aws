/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import AuditService from '@aws/workbench-core-audit/lib/auditService';
import { deaAuditPlugin } from '../audit/dea-audit-plugin';

const continueOnError = false;
const requiredAuditValues = ['actor', 'source'];
const fieldsToMask = ['password', 'accessKey', 'idToken', 'X-Amz-Security-Token'];
export const auditService = new AuditService(
  deaAuditPlugin,
  continueOnError,
  requiredAuditValues,
  fieldsToMask
);
