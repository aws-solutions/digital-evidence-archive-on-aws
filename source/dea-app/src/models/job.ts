/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface Job {
  readonly jobId: string;
  readonly caseUlid: string;
  readonly created?: Date;
  readonly updated?: Date;
}

export interface JobInput {
  readonly jobId: string;
  readonly caseUlid: string;
}
