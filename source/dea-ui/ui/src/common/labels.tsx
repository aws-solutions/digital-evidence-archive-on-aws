/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AppLayoutProps, PaginationProps, PropertyFilterProps } from '@cloudscape-design/components';

// i18nStrings labels for <PropertyFilter>
export const i18nStrings: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: 'your choice',
  dismissAriaLabel: 'Dismiss',
  filteringPlaceholder: 'Search',
  groupValuesText: 'Values',
  groupPropertiesText: 'Properties',
  operatorsText: 'Operators',
  operationAndText: 'and',
  operationOrText: 'or',
  operatorLessText: 'Less than',
  operatorLessOrEqualText: 'Less than or equal to',
  operatorGreaterText: 'Greater than',
  operatorGreaterOrEqualText: 'Greater than or equal to',
  operatorContainsText: 'Contains',
  operatorDoesNotContainText: 'Does not contain',
  operatorEqualsText: 'Equals',
  operatorDoesNotEqualText: 'Does not equal',
  editTokenHeader: 'Edit filter',
  propertyText: 'Property',
  operatorText: 'Operator',
  valueText: 'Value',
  cancelActionText: 'Cancel',
  applyActionText: 'Apply',
  allPropertiesLabel: 'All properties',
  tokenLimitShowMore: 'Show more',
  tokenLimitShowFewer: 'Show fewer',
  clearFiltersText: 'Clear filters',
  removeTokenButtonAriaLabel: () => 'Remove token',
  enteredTextLabel: (text: string) => `Use: "${text}"`,
};

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

export const paginationLables: PaginationProps.Labels = {
  nextPageLabel: 'Next page',
  previousPageLabel: 'Previous page',
  pageLabel: (pageNumber: number) => `Page ${pageNumber} of all pages`,
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
  loading: 'loading cases',
  noCasesLabel: 'No cases',
  noDisplayLabel: 'No cases to display.',
  createNewCaseLabel: 'Create new case',
  searchCasesLabel: 'Search by case name',
  casesLabel: 'Cases',
  casesPageDescription: 'This is a list of cases that have been shared with you.',
};

export const filesListLabels = {
  caseFilesLabel: 'Case Files',
  loading: 'Loading files',
  noFilesLabel: 'No files',
  noDisplayLabel: 'No files to dsiplay.',
  uploadFileLabel: 'Upload a file',
  searchLabel: 'Search by file name',
  filterDescription: 'All folders/files associated with this case.',
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
