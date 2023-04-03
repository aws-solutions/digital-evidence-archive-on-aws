/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaCaseDTO {
  readonly ulid: string;
  readonly name: string;
  readonly status: string;
  readonly description?: string;
  readonly objectCount?: number;
  readonly created: string;
  readonly updated: string;
}

export interface ScopedDeaCaseDTO {
  readonly ulid: string;
  readonly name: string;
}

export interface CaseOwnerDTO {
  readonly userUlid: string;
  readonly caseUlid: string;
}
