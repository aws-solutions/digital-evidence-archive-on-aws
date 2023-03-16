/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AppLayoutProps } from '@cloudscape-design/components';

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
  uploadDetailsLabel: 'Upload details',
  selectFileDescription: 'Select a file to upload',
  evidenceTagLabel: 'Evidence tag',
  evidenceTagDescription:
    'Specify the type of device where the evidence is copied from such as mobile, laptop, or hard drive.',
  evidenceDetailsLabel: 'Description',
  evidenceDetailsDescription:
    'Enter a brief description of the evidence being uploaded. Max character limit 250.',
  uploadReasonLabel: 'Reason for uploading evidence - optional',
  uploadReasonDescription: 'Specify why you are accessing the case files.',
  selectFileSubtext: 'All file types accepted. 5TB max file size.',
};

export const caseDetailLabels = {
  caseFilesLabel: 'Case Files',
  auditLogLabel: 'Audit Log',
  manageAccessLabel: 'Manage case access',
};

export const auditLogLabels = {
  downloadCSVLabel: 'Download CSV',
  caseAuditLogLabel: 'Case audit log',
  descriptionLabel:
    'This tabel records all activity and changes having to do with this case. SHA 256 Hash will display in downloaded file',
  emptyAuditLabel: 'No audit',
  noDisplayAuditLabel: 'No audit to display.',
  loadingLabel: 'loading audit log',
};

export const manageCaseAccessLabels = {
  manageCaseAccessLabel: 'Manage Case Access',
  manageAccessDescription:
    'Members added or remvoed will be notified by email. Their access to case details will be based on permissions set',
  manageAccessSearchLabel: 'Search for people to invite',
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
