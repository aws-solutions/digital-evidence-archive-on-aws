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
  goBack: 'Go back',
  runTask: 'Start file transfer',
  confirmButton: 'Confirm',
  howItworksLabel: 'How it works',
  closeButton: 'Close',
  disassociateButton: 'Disassociate',
  copyLinkLabel: 'copy link',
  linkCopiedLabel: 'Link copied',
};

export const commonTableLabels = {
  timestampHeader: 'Timestamp',
  nameHeader: 'Name',
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
  fileSizeHeader: 'File size',
  dateUploadedHeader: 'Upload date',
  uploadedByHeader: 'Uploaded by',
  caseFileAudit: 'Download Case File Audit',
  limitShowFewerLabel: 'Show fewer',
  limitShowMoreLabel: 'Show more',
  dataSyncTaskIdHeader: 'Task ID',
  sourceLocationIdHeader: 'Source location ID',
  destinationLocationIdHeader: 'Destination location ID',
  dataVaultNameHeader: 'Data vault name',
  fileTransferInstructionsText: 'File transfer instructions',
  implementationGuideLabel: 'implementation guide',
  executionIdHeader: 'Execution ID',
  caseAssociationHeader: 'Case association',
  associateButtonLabel: 'Associate to case',
  lastExecutionCompletedHeader: 'Last execution completed',
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
  downloadFileReasonLabel: 'Downloading files',
  downloadFileReasonInputHeader: 'Reason for downloading folders and files',
  downloadFileReasonInputDetails:
    "Specify why you're downloading the case files. This will be displayed in the case audit log.",
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
  downloadSucceeds: (numFiles: number) => `All ${numFiles} files successfully downloaded`,
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
  dataVaultAuditLogLabel: 'Download Data vault audit log CSV',
  descriptionLabel:
    'This table records all activity and changes having to do with this case. SHA 256 Hash will display in downloaded file.',
  emptyAuditLabel: 'No audit',
  noDisplayAuditLabel: 'No audit to display.',
  loadingLabel: 'loading audit log',
  errorLabel: 'Error downloading audit logs. Audit query is empty or encountered an error or cancellation.',
  downloadAuditFail: (targetName: string) => `Failed to download audit report for ${targetName}`,
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
    'Reach out to your administrator and request a new user to be invited to the system.',
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
  manageCaseLabel: 'Manage case',
  uploadFilesAndFoldersLabel: 'Upload folders and files',
  editCaseLabel: 'Edit case',
  dataVaultsLabel: 'Data vaults',
  createNewDataVaultLabel: 'Create data vault',
  dataSyncTasks: 'Tasks',
  editDataVaultLabel: 'Edit data vault',
};

export const navigationLabels = {
  documentationLabel: 'Documentation',
  myCasesLabel: 'My cases',
  allSystemCasesLabel: 'All cases',
  systemAuditLogsLabel: 'Download system audit log',
  dataVaultsLabel: 'Data vaults',
  dataSyncTasksLabel: 'File transfer tasks',
  caseDetailLabel: 'Case details',
  createCaseLabel: 'Create case',
  createDataVaultLabel: 'Create data vault',
  dataVaultDetailLabel: 'Data vault details',
  dataVaultFileDetailLabel: 'Data vault file details',
  editCaseLabel: 'Edit case',
  editDataVaultLabel: 'Edit data vault',
  fileDetailLabel: 'File detail',
  loginLabel: 'Login',
  manageCaseLabel: 'Manage case',
  uploadFilesLabel: 'Upload files',
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
  associatedBy: 'Associated by',
  dataVaultLabel: 'Data vault',
  associationDateLabel: 'Case association date',
  fileDetailsLabel: 'File details',
};

export const systemUseNotificationText =
  'CUSTOMIZE YOUR SYSTEM USE NOTIFICATION TEXT according ' +
  'to your local laws and regulations. This is needed to fulfill CJIS Policy 5.5.4. (Use Notification). ' +
  'Refer to the Implementation Guide for instructions on how to customize this text, and review ' +
  'CJIS Policy 5.5.4 for latest requirement details.';

export const dataVaultListLabels = {
  loading: 'Loading data vaults',
  noDataVaultsLabel: 'No data vaults to display',
  noDataVaultsMatchLabel: 'No data vaults matched',
  noDisplayLabel: "You don't have any data vaults. Start by creating a data vault.",
  createNewDataVaultLabel: 'Create data vault',
  searchDataVaultsLabel: 'Search by data vault name',
  dataVaultsLabel: 'Data vaults',
  dataVaultsPageDescription:
    'All data vaults are listed. You can search for a data vault and associate files to a case.',
  filteringPlaceholder: 'Search by name',
  fileTransferDescription: 'For file transfer, see',
  howItWorksTitle: 'How it works: Mass files transfers',
  howItWorksDescription: 'For further details on all steps see the',
  howItWorksStepOneDescription: "1. In DEA, create a data vault for the files you'd like to transfer.",
  howItWorksStepTwoDescription:
    '2. Sign in to AWS DataSync and create a source location, destination location, and a task. Then return to DEA.',
  howItWorksStepThreeDescription:
    '3. In DEA, go to All tasks and select the task you created to start the file transfer.',
  howItWorksStepFourDescription:
    '4. After your files are transferred, go to the data vault you created and associate them with a case. Done!',
  howItWorksStepOneImageLabel: 'Step one',
  howItWorksStepTwoImageLabel: 'Step two',
  howItWorksStepThreeImageLabel: 'Step three',
  howItWorksStepFourImageLabel: 'Step four',
};

export const createDataVaultLabels = {
  createNewDataVaultLabel: 'Create data vault',
  createNewDataVaultDescription:
    'Data vaults store all transferred files. All fields are required unless specified.',
  enterDetailsLabel: 'Enter data vault details',
  enterDetailsLabelOnUpdate: 'Details',
  nameLabel: 'Name',
  nameDescription: 'Create a unique name that you can easily reference and find in data vaults.',
  nameSubtext: 'The name can have up to 100 characters. Valid characters: A-Z, a-z, 0-9, and spaces.',
  descriptionLabel: 'Description - ',
  descriptionDescription: 'Enter a brief description for your data vault.',
  descriptionSubtext: 'Descriptions can have up to 250 characters.',
  successNotificationMessage: 'Data vault created successfully. For file transfer instructions, see the',
  viewImplementationGuideText: 'View Implementation Guide for next steps.',
  successNotificationMessageOnUpdate: 'Data vault has been successfully updated.',
};

export const dataVaultDetailLabels = {
  dataVaultDetailsLabel: 'Data vault details',
  ulidLabel: 'Data vault ULID',
  objectCounterLabel: 'Number of files',
  totalSizeLabel: 'Total size',
  noFilesLabel: 'No files to display.',
  noFilesDisplayLabel: 'For file transfer instructions, see the Implementation guide.',
  filesLabel: 'Files',
  filesTableHeaderDescription:
    'Folders and files uploaded to the Data vault. For file transfer instructions, see the',
  filesDatasyncSignInLabel: 'or sign into AWS DataSync with your DEA account.',
  displayFilesCheckboxLabel: 'Display files not associated with a case',
  copyDataVaultUlidAriaLabel: 'Copy data vault ulid',
  noAssociatedLabel: 'Not associated',
  associatedLabel: 'Associated',
  disassociateLabel: 'Disassociate file',
  associateToCaseModalTitle: 'Choose case to associate to file(s)',
  associateToCaseDescription: 'Search for case and select.',
  associateToCaseSuccessNotificationMessage: 'File(s) successfully associated to the case',
  associateToCaseMultiselectPlaceholder: 'Choose case',
  associateToCaseMultiselectFilteringPlaceholder: 'Search by case name',
  disassociateFromCaseSuccessNotificationMessage: 'File successfully disassociated from the case(s)',
  disassociateFromCaseModalTitle: 'Disassociate file',
  disassociateFromCaseModalSectionHeader: 'Select case to diassociate from the file',
  disassociateWarning:
    'This file will no longer be available under the cases you select to disassociate. It will only be accessible through the data vault or associated cases.',
};

export const dataSyncTaskListLabels = {
  loading: 'Loading data sync tasks',
  noDataSyncTasksLabel: 'No data sync tasks have been created.',
  noDataSyncTasksMatchLabel: 'No data sync tasks matched',
  noDisplayLabel: 'Once data sync tasks are created, they will be displayed.',
  runDataSyncTaskLabel: 'Transfer files',
  searchDataSyncTasksLabel: 'Search by task ID',
  dataSyncTasksLabel: 'File transfer tasks',
  dataSyncTasksPageDescription:
    'Choose a task and start the file transfer. For file transfer instructions, see the',
  dataSyncTaskCreationInstructions: 'Task Creation Instructions.',
  runTaskModalTitle: 'Confirm details are correct',
  runTaskModalDescription: 'To update task details, sign into AWS DataSync with your DEA account.',
  runTaskLocationsLabel: 'Files will be transferred between these locations',
  runTaskModalAlertText: 'Once the task transfers the files into Data vault, they cannot be deleted.',
  startTaskSuccessNotificationMessage:
    'Task is running successfully. This can take a while depending on the size of the files being transferred.',
  completedTaskSuccessNotificationMessage:
    'Your DataSync task has successfully completed. All files have been transferred to the Data vault.',
};

export const dataSyncTasksStatusLabels = {
  available: 'Available',
  running: 'Running',
  queued: 'Queued',
  unavailable: 'Unavailable',
};
