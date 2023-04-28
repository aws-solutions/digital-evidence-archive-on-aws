/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaSession {
  readonly userUlid: string;
  readonly tokenId: string;
  readonly ttl: number;
  readonly isRevoked: boolean;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface DeaSessionInput {
  readonly userUlid: string;
  readonly tokenId: string;
}
