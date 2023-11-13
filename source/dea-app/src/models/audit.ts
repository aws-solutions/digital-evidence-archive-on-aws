/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DEAAuditQuery {
  readonly from: number;
  readonly to: number;
}

export const defaultAuditQuery: DEAAuditQuery = {
  from: 0,
  to: Date.now(),
};
