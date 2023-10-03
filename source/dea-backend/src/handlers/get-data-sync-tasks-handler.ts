/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataSyncTasks } from '@aws/dea-app/lib/app/resources/get-data-sync-tasks';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getDataSyncTasks, NO_ACL);
