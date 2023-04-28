/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { downloadCaseFile } from '@aws/dea-app/lib/app/resources/download-case-file';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(downloadCaseFile, [CaseAction.DOWNLOAD]);
