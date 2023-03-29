/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '../case-action';

export interface CaseUserDTO {
  readonly userUlid: string;
  readonly caseUlid: string;
  readonly actions: CaseAction[];
}

export interface CaseOwnerDTO {
  readonly userUlid: string;
  readonly caseUlid: string;
}
