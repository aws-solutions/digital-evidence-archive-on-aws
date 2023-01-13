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
  uploadButton: 'Upload',
  downloadButton: 'Download',
  loadingLabel: 'Loading...',
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
};

export const caseListLabels = {
  loading: 'loading cases',
  noCasesLabel: 'No cases',
  noDisplayLabel: 'No cases to display.',
  createNewCaseLabel: 'Create new case',
  searchCasesLabel: 'Search by case name',
  archiveButton: 'Archive Case',
  activateButton: 'Activate Case',
  casesLabel: 'Cases',
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
  enterCaseDetailsLabel: 'Enter Case Details',
  caseNameLabel: 'Case name',
  caseDescription: 'Description - optional',
};
