/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaUser {
  readonly ulid: string;
  readonly tokenId: string;
  readonly idPoolId?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface DeaUserInput {
  readonly tokenId: string;
  readonly idPoolId?: string;
  readonly firstName: string;
  readonly lastName: string;
}
