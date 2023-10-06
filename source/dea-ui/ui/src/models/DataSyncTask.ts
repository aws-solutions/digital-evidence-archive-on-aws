/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataSyncTask } from '@aws/dea-app/lib/models/data-sync-task';

export interface DeaDataSyncTaskDTO extends DeaDataSyncTask {
  dataVaultName?: string;
}
export enum TaskStatus {
  AVAILABLE = 'AVAILABLE',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  UNAVAILABLE = 'UNAVAILABLE',
}
