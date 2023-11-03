/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { startCaseFileAudit } from '@aws/dea-app/lib/app/resources/audit/start-case-file-audit';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(startCaseFileAudit, [CaseAction.CASE_AUDIT]);
