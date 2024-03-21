/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getCaseAudit } from '@aws/dea-app/lib/app/resources/audit/get-case-audit';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(getCaseAudit, [CaseAction.CASE_AUDIT]);
