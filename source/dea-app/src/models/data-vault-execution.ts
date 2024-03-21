/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaDataVaultExecution {
  readonly executionId: string;
  readonly taskId: string;
  readonly created?: Date;
  readonly createdBy: string;
}

export interface DataVaultExecutionDTO {
  readonly taskArn: string;
}
