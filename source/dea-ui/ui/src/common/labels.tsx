/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction, OWNER_ACTIONS } from '@aws/dea-app/lib/models/case-action';
import { AppLayoutProps, SelectProps } from '@cloudscape-design/components';

export const commonLabels = {
  cancelButton: 'Cancel',
  doneButton: 'Done',
  submitButton: 'Submit',
  createButton: 'Create',
  editButton: 'Edit',
  uploadButton: 'Upload',
  uploadAndSaveButton: 'Upload and save',
  activateButton: 'Activate',
  deactivateButton: 'Deactivate',
  addButton: 'Add',
  removeButton: 'Remove',
  downloadButton: 'Download',
  restoreButton: 'Restore',
  saveButton: 'Save',
  saveUpdatesButton: 'Save updates',
  loadingLabel: 'Loading...',
  statusLabel: 'Status',
  loginLabel: 'Logging into the Digital Evidence Archive.',
  notFoundLabel: 'Not found',
  noMatchesLabel: 'No matches found',
  retryLabel: 'Retry',
  errorLabel: 'Error fetching results',
  dismissMessageLabel: 'Dismiss message',
  description: 'Description',
  creationDate: 'Creation date',
  requiredField: 'This is a required field.',
  requiredLength: 'Required field must be at least 2 characters long.',
  closeModalAriaLabel: 'Close modal',
  optionalLabel: 'optional',
};

export const commonTableLabels = {
  timestampHeader: 'Timestamp',
  nameHeader: 'File name',
  fileNameHeader: 'File name',
  actionHeader: 'Action',
  reasonHeader: 'Reason',
  caseNameHeader: 'Case name',
  caseLeadHeader: 'Case lead(s)',
  objectCounterHeader: 'Number of files',
  totalSize: 'Total size',
  creationDateHeader: 'Creation date',
  statusHeader: 'Status',
  fileTypeHeader: 'File type',
  fileSizeHeader: 'Size',
  dateUploadedHeader: 'Upload date',
  uploadedByHeader: 'Uploaded by',
  caseFileAudit: 'Download Case File Audit',
  limitShowFewerLabel: 'Show fewer',
  limitShowMoreLabel: 'Show more',
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
  noCasesLabel: 'No cases have been created.',
  noCasesMatchLabel: 'No cases matched',
  noDisplayLabel: 'Once cases are created, they will be displayed.',
  createNewCaseLabel: 'Create case',
  activateCaseLabel: 'Activate case',
  deactivateCaseLabel: 'Deactivate case',
  deactivateCaseModalLabel: (name: string) => `Are you sure you want to deactivate ${name}?`,
  deactivateCaseModalMessage:
    'Once the case is deactivated, anyone with access will not be able to edit, or upload and download files to the case. We will keep all your files unless you prefer to delete them.',
  deleteFilesLabel: 'Delete all files',
  activateCaseModalLabel: (name: string) => `Are you sure you want to activate ${name}?`,
  activateCaseModalMessage:
    'Once the case is activated, anyone with access will be able to edit, add case members, or upload/download files to the case.',
  searchCasesLabel: 'Search by case name',
  casesLabel: 'My cases',
  systemCasesLabel: 'All cases',
  casesPageDescription: 'Search for cases, view case details, or create new cases to store digital evidence.',
  systemCasesPageDescription:
    'All cases within the system are listed, including ones that haven’t been shared with you. You can search for cases and give member access.',
};

export const filesListLabels = {
  caseFilesLabel: 'Case files',
  loading: 'Loading files',
  noFilesLabel: "It's looking empty in here.",
  noDisplayLabel: 'No files to display.',
  uploadFileLabel: 'Upload a file',
  searchLabel: 'Search by file name',
  filterDescription: 'Uploaded folders and files associated with this case.',
};

export const fileOperationsLabels = {
  caseFilesLabel: 'Case files',
  uploadFileLabel: 'Upload folders and files',
  uploadFileDescription: 'All fields are required unless otherwise indicated.',
  uploadStatusDescription: 'Uploaded files associated with this case.',
  uploadDetailsLabel: 'Upload details',
  selectFileDescription: 'Choose files',
  restoreFilesModalLabel: (count: number) =>
    `${count} of the files you tried to download was archived due to inactivity.`,
  restoreFilesModalDescription: 'The restored files will become available for download within 12 hours.',
  evidenceTagLabel: 'Evidence tag',
  evidenceTagDescription:
    "Specify the device type that you're copying evidence from (examples: mobile, laptop, or hard drive).",
  evidenceDetailsLabel: 'Description',
  evidenceDetailsDescription:
    'Enter a brief description of the evidence being uploaded. Max character limit 250.',
  uploadReasonLabel: 'Reason for uploading evidence',
  uploadReasonDescription: "Explain why you're accessing the case files.",
  selectFileSubtext: 'All file types accepted. 5TB maximum file size.',
  auditLogLabel: 'Case file audit log',
  restoreSuccessful: 'Successfully initiated restore for selected files.',
  restoreFail: 'Failed to restore selected files.',
  modalTitle: 'Confirm you want to upload these files.',
  modalBody: 'Once uploaded case files cannot be individually removed.',
  restoreInProgress: (fileName: string) =>
    `The recovery of file ${fileName} has been successfully started. The file will become viewable within 12 hours.`,
  archivedFileNoPermissionError: (fileName: string) =>
    `${fileName} is archived. Please contact case owner to restore file for access.`,
  downloadFailed: (fileName: string) => `Failed to download ${fileName}`,
  cancelRestoringLabel: 'Cancel',
};

export const caseDetailLabels = {
  caseFilesLabel: 'Case files',
  auditLogLabel: 'Audit log',
  manageAccessLabel: 'Assign case permissions',
  caseDetailsLabel: 'Case details',
};

export const auditLogLabels = {
  downloadCSVLabel: 'Download case audit log CSV',
  caseAuditLogLabel: 'Audit log',
  caseFileAuditLogLabel: 'Download file audit log CSV',
  downloadFileAuditLabel: 'Download file audit log CSV',
  descriptionLabel:
    'This table records all activity and changes having to do with this case. SHA 256 Hash will display in downloaded file.',
  emptyAuditLabel: 'No audit',
  noDisplayAuditLabel: 'No audit to display.',
  loadingLabel: 'loading audit log',
  errorLabel: 'Error downloading audit logs. Audit query is empty or encountered an error or cancellation.',
  downloadCaseAuditFail: (fileName: string) => `Failed to download case file audit for ${fileName}`,
};

export const paginationLabels = {
  nextPageLabel: 'Next page',
  pageLabel: (pageNumber: number) => `Go to page ${pageNumber}`,
  previousPageLabel: 'Previous page',
};

export const manageCaseAccessLabels = {
  manageCaseAccessLabel: 'Case members',
  assignCaseOwnersLabel: 'Assign invite permissions',
  manageAccessDescription:
    'Members added or removed will be notified by email. Their access to case details will be based on permissions set.',
  manageAccessSearchLabel: 'Search for people',
  manageAccessSearchInfoHeader: "Can't find someone?",
  manageAccessSearchInfoLabel: 'Request access from admin',
  manageAccessSearchInfoDescription:
    'reach out to your administrator and request a new user to be invited to the system.',
  searchPlaceholder: 'Search by name or email',
  searchAutosuggestNoMatches: 'No matches found',
  searchAutosuggestEnteredText: (value: string) => `Use: "${value}"`,
  searchAutosuggestLoadingText: 'Loading users',
  searchAutosuggestFinishedText: (value: string) =>
    value ? `End of "${value}" results` : 'End of all results',
  manageCasePeopleAccessLabel: 'People with access',
  manageOwnerAccessLabel: 'People with invite permissions',
  manageMemberEmailLabel: 'View email',
  manageMemberAccessTypeLabel: 'Access type',
  manageMemberPermissionsLabel: 'Permission(s)',
  manageMemberPermissionsPlaceholder: 'Choose permissions',
  addCaseMemberSuccessMessage: (user: string) => `${user} has been invited to the case successfully.`,
  addCaseMemberFailMessage: (user: string) => `${user} has not been invited to the case.`,
  addCaseOwnerSuccessMessage: (user: string) =>
    `${user} was successfully assigned invite permissions on the case.`,
  addCaseOwnerFailMessage: (user: string) => `Failed to assign ${user} invite permissions on the case.`,
  removeCaseMemberSuccessMessage: (user: string) => `${user} has been removed successfully.`,
  removeCaseMemberFailMessage: (user: string) => `${user} has not been removed.`,
  removeCaseMemberRequestTitle: (user: string) => `Remove ${user}?`,
  removeCaseMemberRequestMessage:
    'There access will be instantly removed and they will be notified by email.',
  saveSuccessMessage: 'Changes have been saved successfully.',
  saveFailMessage: 'Changes have not been saved.',
};

export const caseStatusLabels = {
  active: 'Active',
  inactive: 'Inactive',
};

export const createCaseLabels = {
  createNewCaseLabel: 'Create case',
  createNewCaseDescription: 'All fields are required unless specified.',
  enterCaseDetailsLabel: 'Enter case details',
  caseNameLabel: 'Case name',
  caseNameSubtext: 'Alphanumeric characters only. No special charcaters.',
  caseDescription: 'Description - ',
  caseNameDescription: ' Create a Unique name that you can easily reference.',
  caseDescriptionSubtext: 'Enter a brief description for your case.',
  activeLabel: 'Active',
  archivedLabel: 'Archived',
  caseStatusLabel: 'Case status',
  activeCaseDescription:
    'Cases are Active by default. When a case is Active you can upload/download files and share a case.',
  archivedCaseDescription:
    'Everyone invited to the case still has access to it, but are not able to download or upload files to the case.',

  // Share case container
  shareCaseLabel: 'Share case',
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
      case CaseAction.UPDATE_CASE_STATUS:
        return {
          value: CaseAction.UPDATE_CASE_STATUS,
          label: 'Update case status',
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
      case CaseAction.RESTORE_FILES:
        return {
          value: CaseAction.RESTORE_FILES,
          label: 'Restore files',
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

export const breadcrumbLabels = {
  homePageLabel: 'Digital Evidence Archive',
  createNewCaseLabel: 'Create case',
  caseLabel: 'Case',
  caseDetailsLabel: 'Case details',
  manageCaseLabel: 'Manage case',
  uploadFilesAndFoldersLabel: 'Upload folders and files',
  editCaseLabel: 'Edit case',
  fileDetailsLabel: 'File details',
};

export const navigationLabels = {
  documentationLabel: 'Documentation',
  myCasesLabel: 'My cases',
  allSystemCasesLabel: 'All cases',
  systemAuditLogsLabel: 'Download system audit log',
};

export const fileUploadLabels = {
  dragAndDropFolderLabel: 'Drag and drop files or',
  chooseFolderLabel: 'Choose folders',
  chooseFilesLabel: 'Choose files',
  errorIconAriaLabel: 'Error',
  removeFileAriaLabel: (e: number) => `Remove file ${e + 1}`,
};

export const fileDetailLabels = {
  uploadDateLabel: 'Upload date',
  fileSizeLabel: 'File size',
  shaHashLabel: 'SHA 256 hash',
};

export const systemUseNotificationText =
  'OFFICIAL SENSITIVE - Any Processing or viewing of sensitive data shall be strictly necessary and shall meet the conditions under Schedule 8 Part 3 of the Data Protection Act 2018. ' +
  'It is an offence to continue without proper authority. Users must read and conform to the Security Work Instructions for this system. ' +
  'User interactions are monitored and any unauthorised access or attempts to alter, destroy or damage data, programs or equipment could result in criminal prosecution under the Computer Misuse Act (1990).';
