/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getCaseFileAudit } from '@aws/dea-app/lib/app/resources/get-case-file-audit';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(getCaseFileAudit, [CaseAction.CASE_AUDIT]);
