/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaDataVaultTask {
  readonly taskId: string;
  readonly dataVaultUlid: string;
  readonly name: string;
  readonly description?: string;
  readonly sourceLocationArn: string;
  readonly destinationLocationArn: string;
  readonly taskArn: string;
  readonly created?: Date;
  readonly updated?: Date;
  readonly deleted: boolean;
}

export interface DeaDataVaultTaskInput {
  readonly taskId: string;
  readonly dataVaultUlid: string;
  readonly name: string;
  readonly description?: string;
  readonly sourceLocationArn: string;
  readonly destinationLocationArn: string;
  readonly taskArn: string;
  readonly s3BucketPrefix: string;
  readonly deleted: boolean;
}
