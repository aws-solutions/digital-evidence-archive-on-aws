/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { updateCaseStatus } from '@aws/dea-app/lib/app/resources/update-case-status';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';
import { deleteCaseFileHandler } from '@aws/dea-app/lib/app/storage/s3-batch-delete-case-file-handler';

export const handler = createDeaHandler(updateCaseStatus, [CaseAction.UPDATE_CASE_STATUS]);
