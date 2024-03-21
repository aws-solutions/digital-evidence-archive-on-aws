/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaDataVault {
  readonly ulid: string;
  readonly name: string;
  readonly description?: string;
  readonly objectCount: number;
  readonly totalSizeBytes: number;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface DeaDataVaultInput {
  readonly name: string;
  readonly description?: string;
}

export interface DeaDataVaultUpdateInput {
  readonly ulid: string;
  readonly name: string;
  readonly description?: string;
}
