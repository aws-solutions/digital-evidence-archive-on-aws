/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaDataSyncTask {
  readonly taskArn: string;
  readonly taskId: string;
  readonly sourceLocationArn?: string;
  readonly destinationLocationArn?: string;
  readonly dataVaultUlid?: string;
  readonly status?: string;
  readonly created?: Date;
  readonly lastExecutionCompleted?: Date;
}
