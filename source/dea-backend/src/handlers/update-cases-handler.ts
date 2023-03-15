/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { updateCases } from '@aws/dea-app/lib/app/resources/update-cases';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(updateCases, [CaseAction.UPDATE_CASE_DETAILS]);
