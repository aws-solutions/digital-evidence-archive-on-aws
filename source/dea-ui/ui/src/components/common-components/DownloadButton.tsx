/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DownloadDTO } from '@aws/dea-app/lib/models/case-file';
import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import { Button, SpaceBetween, Spinner } from '@cloudscape-design/components';
import { useState } from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { getPresignedUrl, useGetCaseActions } from '../../api/cases';
import { commonLabels, fileOperationsLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { canDownloadFiles, canRestoreFiles } from '../../helpers/userActionSupport';
import { FormFieldModal } from '../common-components/FormFieldModal';

export interface DownloadButtonProps {
  readonly caseId: string;
  readonly caseStatus: CaseStatus;
  readonly selectedFiles: DownloadDTO[];
  selectedFilesCallback: (setSelectedFiles: DownloadDTO[]) => void;
  readonly downloadInProgress: boolean;
  downloadInProgressCallback: (setDownloadInProgress: boolean) => void;
  readonly filesToRestore: DownloadDTO[];
  filesToRestoreCallback: (setFilesToRestore: DownloadDTO[]) => void;
}

function DownloadButton(props: DownloadButtonProps): JSX.Element {
  const { pushNotification } = useNotifications();
  const userActions = useGetCaseActions(props.caseId);
  const availableEndpoints = useAvailableEndpoints();
  const [downloadReasonModalOpen, setDownloadReasonModalOpen] = useState(false);
  const [downloadReason, setDownloadReason] = useState('');

  async function downloadFilesHandler() {
    const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
    try {
      setDownloadReasonModalOpen(false);
      props.downloadInProgressCallback(true);

      let allFilesDownloaded = true;
      for (const file of props.selectedFiles) {
        try {
          const downloadResponse = await getPresignedUrl({
            caseUlid: file.caseUlid,
            ulid: file.ulid,
            downloadReason: downloadReason,
          });

          if (!downloadResponse.downloadUrl) {
            if (downloadResponse.isRestoring) {
              pushNotification('info', fileOperationsLabels.restoreInProgress(file.fileName));
            } else if (downloadResponse.isArchived) {
              if (canRestoreFiles(userActions?.data?.actions, availableEndpoints.data)) {
                props.filesToRestoreCallback([...props.filesToRestore, file]);
              } else {
                pushNotification('error', fileOperationsLabels.archivedFileNoPermissionError(file.fileName));
              }
            }
            continue;
          }
          const alink = document.createElement('a');
          alink.href = downloadResponse.downloadUrl;
          alink.download = file.fileName;
          alink.click();
          // sleep 5ms => common problem when trying to quickly download files in succession => https://stackoverflow.com/a/54200538
          // long term we should consider zipping the files in the backend and then downloading as a single file
          await sleep(100);
        } catch (e) {
          pushNotification('error', fileOperationsLabels.downloadFailed(file.fileName));
          console.log(`failed to download ${file.fileName}`, e);
          allFilesDownloaded = false;
        }
      }

      if (allFilesDownloaded) {
        pushNotification('success', fileOperationsLabels.downloadSucceeds(props.selectedFiles.length));
      }
    } finally {
      props.downloadInProgressCallback(false);
      setDownloadReason('');
      props.selectedFilesCallback([]);
    }
  }

  return (
    <SpaceBetween direction="horizontal" size="xs">
      <FormFieldModal
        modalTestId="download-file-reason-modal"
        inputTestId="download-file-reason-modal-input"
        cancelButtonTestId="download-file-reason-modal-cancel-button"
        primaryButtonTestId="download-file-reason-modal-primary-button"
        isOpen={downloadReasonModalOpen}
        title={fileOperationsLabels.downloadFileReasonLabel}
        inputHeader={fileOperationsLabels.downloadFileReasonInputHeader}
        inputDetails={fileOperationsLabels.downloadFileReasonInputDetails}
        inputField={downloadReason}
        setInputField={setDownloadReason}
        confirmAction={downloadFilesHandler}
        confirmButtonText={commonLabels.downloadButton}
        cancelAction={() => {
          // close modal and delete any reason inputted
          setDownloadReasonModalOpen(false);
          setDownloadReason('');
        }}
        cancelButtonText={commonLabels.cancelButton}
      />
      <Button
        data-testid="download-file-button"
        variant="primary"
        onClick={() => {
          setDownloadReasonModalOpen(true);
        }}
        disabled={
          props.selectedFiles.length === 0 ||
          props.downloadInProgress ||
          !canDownloadFiles(userActions?.data?.actions) ||
          // inactive case can't download evidence, even if evidence are all active/not destroyed
          props.caseStatus !== CaseStatus.ACTIVE ||
          // individual evidence download page needs special disallow case since the page requires a selectedFiles entry to load metadata
          (props.selectedFiles.length === 1 && props.selectedFiles[0].status !== CaseFileStatus.ACTIVE)
        }
      >
        {commonLabels.downloadButton}
        {props.downloadInProgress ? <Spinner size="normal" /> : null}
      </Button>
    </SpaceBetween>
  );
}

export default DownloadButton;
