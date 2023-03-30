/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction, OWNER_ACTIONS } from '@aws/dea-app/lib/models/case-action';
import { AppLayoutProps, SelectProps } from '@cloudscape-design/components';

export const commonLabels = {
  cancelButton: 'Cancel',
  submitButton: 'Submit',
  createButton: 'Create',
  uploadButton: 'Upload',
  addButton: 'Add',
  removeButton: 'Remove',
  downloadButton: 'Download',
  loadingLabel: 'Loading...',
  loginLabel: 'Logging in...',
  notFoundLabel: 'Not Found',
  noMatchesLabel: 'No matches found',
  retryLabel: 'Retry',
  errorLabel: 'Error fetching results',
  dismissMessageLabel: 'Dismiss message',
  description: 'Description',
  creationDate: 'Creation Date',
  closeModalAriaLabel: 'Close modal',
};

export const commonTableLabels = {
  timestampHeader: 'Timestamp',
  nameHeader: 'Name',
  fileNameHeader: 'File name',
  actionHeader: 'Action',
  reasonHeader: 'Reason',
  caseNameHeader: 'Case name',
  caseLeadHeader: 'Case Lead(s)',
  objectCounterHeader: 'No. of files',
  creationDateHeader: 'Creation date',
  statusHeader: 'Status',
  fileTypeHeader: 'File type',
  fileSizeHeader: 'Size',
  dateUploadedHeader: 'Date uploaded',
  uploadedByHeader: 'Uploaded by',
};

export const layoutLabels: AppLayoutProps.Labels = {
  navigation: 'Navigation drawer',
  navigationClose: 'Close navigation drawer',
  navigationToggle: 'Open navigation drawer',
  notifications: 'Notifications',
  tools: 'Help panel',
  toolsClose: 'Close help panel',
  toolsToggle: 'Open help panel',
};

export const headerLabels = {
  searchIconAriaLabel: 'Search',
  searchDismissIconAriaLabel: 'Close search',
  overflowMenuTriggerText: 'More',
  overflowMenuTitleText: 'All',
  overflowMenuBackIconAriaLabel: 'Back',
  overflowMenuDismissIconAriaLabel: 'Close menu',
  signout: 'Sign out',
  notLoggedIn: ' - Not Logged In',
};

export const caseListLabels = {
  loading: 'Loading cases',
  noCasesLabel: 'No cases',
  noCasesMatchLabel: 'No cases matched',
  noDisplayLabel: 'No cases to display',
  createNewCaseLabel: 'Create new case',
  searchCasesLabel: 'Search by case name',
  casesLabel: 'Cases',
  systemCasesLabel: 'All System Cases',
  casesPageDescription: 'This is a list of cases that have been shared with you.',
};

export const filesListLabels = {
  caseFilesLabel: 'Case Files',
  loading: 'Loading files',
  noFilesLabel: 'No files',
  noDisplayLabel: 'No files to display',
  uploadFileLabel: 'Upload a file',
  searchLabel: 'Search by file name',
  filterDescription: 'All folders/files associated with this case.',
};

export const fileOperationsLabels = {
  caseFilesLabel: 'Case Files',
  uploadFileLabel: 'Upload folders/files',
  uploadFileDescription: 'All fields are required unless otherwise indicated.',
  uploadStatusDescription: 'Uploaded files associated with this case.',
  uploadDetailsLabel: 'Upload details',
  selectFileDescription: 'Choose files',
  evidenceTagLabel: 'Evidence tag',
  evidenceTagDescription:
    'Specify the type of device where the evidence is copied from such as mobile, laptop, or hard drive.',
  evidenceDetailsLabel: 'Description',
  evidenceDetailsDescription:
    'Enter a brief description of the evidence being uploaded. Max character limit 250.',
  uploadReasonLabel: 'Reason for uploading evidence',
  uploadReasonDescription: 'Specify why you are accessing the case files.',
  selectFileSubtext: 'All file types accepted. 5TB max file size.',
};

export const caseDetailLabels = {
  caseFilesLabel: 'Case Files',
  auditLogLabel: 'Audit Log',
  manageAccessLabel: 'Case Members',
};

export const auditLogLabels = {
  downloadCSVLabel: 'Download Case Audit Log CSV',
  caseAuditLogLabel: 'Audit Log',
  descriptionLabel:
    'This tabel records all activity and changes having to do with this case. SHA 256 Hash will display in downloaded file',
  emptyAuditLabel: 'No audit',
  noDisplayAuditLabel: 'No audit to display.',
  loadingLabel: 'loading audit log',
  errorLabel: 'Error downloading case audit. Audit query is empty or encountered an error or cancellation.',
};

export const manageCaseAccessLabels = {
  manageCaseAccessLabel: 'Case Members',
  manageAccessDescription:
    'Members added or removed will be notified by email. Their access to case details will be based on permissions set.',
  manageAccessSearchLabel: 'Search for people',
  manageAccessSearchInfoHeader: "Can't find someone?",
  manageAccessSearchInfoLabel: 'Request Access from Admin',
  manageAccessSearchInfoDescription:
    'reach out to your administrator and request a new user to be invited to the system.',
  searchPlaceholder: 'Search by name or email',
  searchAutosuggestNoMatches: 'No matches found',
  searchAutosuggestEnteredText: (value: string) => `Use: "${value}"`,
  searchAutosuggestLoadingText: 'Loading users',
  searchAutosuggestFinishedText: (value: string) =>
    value ? `End of "${value}" results` : 'End of all results',
  manageCasePeopleAccessLabel: 'People with access',
  manageMemberEmailLabel: 'View Email',
  manageMemberAccessTypeLabel: 'Access Type',
  manageMemberPermissionsLabel: 'Permission(s)',
  manageMemberPermissionsPlaceholder: 'Choose permissions',
  addCaseMemberSuccessMessage: (user: string) => `${user} has been invited to the case successfully.`,
  addCaseMemberFailMessage: (user: string) => `${user} has not been invited to the case.`,
  removeCaseMemberSuccessMessage: (user: string) => `${user} has been removed successfully.`,
  removeCaseMemberFailMessage: (user: string) => `${user} has not been removed.`,
  removeCaseMemberRequestTitle: (user: string) => `Remove ${user}?`,
  removeCaseMemberRequestMessage:
    'There access will be instantly removed and they will be notified by email.',
};

export const createCaseLabels = {
  createNewCaseLabel: 'Create New Case',
  createNewCaseDescription: 'All fields are required unless specified.',
  enterCaseDetailsLabel: 'Enter Case Details',
  caseNameLabel: 'Case name',
  caseNameSubtext: 'Alphanumeric characters only. No special charcaters.',
  caseDescription: 'Description - optional',
  caseNameDescription: ' Create a Unique name that you can easily reference.',
  caseDescriptionSubtext:
    'Enter a brief description of the case to easily identify it. Max character limit ###',
  activeLabel: 'Active',
  archivedLabel: 'Archived',
  caseStatusLabel: 'Case Status',
  activeCaseDescription:
    'Cases are Active by default. When a case is Active you can upload/download files and share a case.',
  archivedCaseDescription:
    'Everyone invited to the case still has access to it, but are not able to download or upload files to the case',

  // Share case container
  shareCaseLabel: 'Share case',
  searchPeopleLabel: 'Search for people',
  searchPeopleDescription:
    'Members added or removed will be notified by email. Their access to the case details will be based on permissions set.',
  searchPlaceholder: 'Search by name or email',
};

export const caseActionOptions = {
  actionOption: (caseAction: CaseAction): SelectProps.Option => {
    switch (caseAction) {
      case CaseAction.UPDATE_CASE_DETAILS:
        return {
          value: CaseAction.UPDATE_CASE_DETAILS,
          label: 'Edit case',
        };
      case CaseAction.UPLOAD:
        return {
          value: CaseAction.UPLOAD,
          label: 'Upload files',
        };
      case CaseAction.DOWNLOAD:
        return {
          value: CaseAction.DOWNLOAD,
          label: 'Download files',
        };
      case CaseAction.VIEW_FILES:
        return {
          value: CaseAction.VIEW_FILES,
          label: 'View case files',
        };
      case CaseAction.CASE_AUDIT:
        return {
          value: CaseAction.CASE_AUDIT,
          label: 'Audit case',
        };
      case CaseAction.INVITE:
        return {
          value: CaseAction.INVITE,
          label: 'Invite members',
        };
      default:
        // default CaseAction.VIEW_CASE_DETAILS least privilege principle.
        return {
          value: CaseAction.VIEW_CASE_DETAILS,
          label: 'View case',
        };
    }
  },
  selectableOptions: (): SelectProps.Option[] => {
    return OWNER_ACTIONS.map((caseAction: CaseAction) => caseActionOptions.actionOption(caseAction));
  },
};
