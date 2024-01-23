/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DownloadDTO } from '@aws/dea-app/lib/models/case-file';
import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import { Button, Spinner } from '@cloudscape-design/components';
import { useAvailableEndpoints } from '../../api/auth';
import { getPresignedUrl, useGetCaseActions } from '../../api/cases';
import { commonLabels, fileOperationsLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { canDownloadFiles, canRestoreFiles } from '../../helpers/userActionSupport';

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

  async function downloadFilesHandler() {
    const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
    try {
      props.downloadInProgressCallback(true);
      for (const file of props.selectedFiles) {
        try {
          const downloadResponse = await getPresignedUrl({ caseUlid: file.caseUlid, ulid: file.ulid });
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
        }
      }
    } finally {
      props.downloadInProgressCallback(false);
      props.selectedFilesCallback([]);
    }
  }

  return (
    <Button
      data-testid="download-file-button"
      variant="primary"
      onClick={downloadFilesHandler}
      disabled={
        props.downloadInProgress ||
        !(canDownloadFiles(userActions?.data?.actions) && props.caseStatus === CaseStatus.ACTIVE)
      }
    >
      {commonLabels.downloadButton}
      {props.downloadInProgress ? <Spinner size="normal" /> : null}
    </Button>
  );
}

export default DownloadButton;
