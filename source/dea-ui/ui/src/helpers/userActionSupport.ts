/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';

const CREATE_CASE_PATH = '/casesPOST';
const UPDATE_CASE_STATUS_PATH = '/cases/{caseId}/statusPUT';
const RESTORE_CASE_FILE_PATH = '/cases/{caseId}/files/{fileId}/restorePUT';

export const canInvite = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.INVITE) ?? false;
};

export const canDownloadFiles = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.DOWNLOAD) ?? false;
};

export const canUploadFiles = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.UPLOAD) ?? false;
};

export const canRestoreFiles = (actions?: CaseAction[], endpoints?: string[]): boolean => {
  return (
    (actions?.includes(CaseAction.RESTORE_FILES) && endpoints?.includes(RESTORE_CASE_FILE_PATH)) ?? false
  );
};

export const canDownloadCaseAudit = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.CASE_AUDIT) ?? false;
};

export const canViewFiles = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.VIEW_FILES) ?? false;
};

export const canViewCaseDetails = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.VIEW_CASE_DETAILS) ?? false;
};

export const canUpdateCaseDetails = (actions?: CaseAction[]): boolean => {
  return actions?.includes(CaseAction.UPDATE_CASE_DETAILS) ?? false;
};

export const canUpdateCaseStatus = (endpoints?: string[]): boolean => {
  return endpoints?.includes(UPDATE_CASE_STATUS_PATH) ?? false;
};

export const canCreateCases = (endpoints?: string[]): boolean => {
  return endpoints?.includes(CREATE_CASE_PATH) ?? false;
};
