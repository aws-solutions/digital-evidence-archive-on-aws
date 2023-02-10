/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export enum CaseAction {
  VIEW_CASE_DETAILS = 'VIEW_CASE_DETAILS',
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  VIEW_FILES = 'VIEW_FILES',
  CASE_AUDIT = 'CASE_AUDIT',
  INVITE = 'INVITE',
}

export const OWNER_ACTIONS: CaseAction[] = Object.values(CaseAction);
