/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  ChecksumAlgorithm,
  S3Client,
  UploadPartCommand,
  UploadPartCommandInput,
  UploadPartCommandOutput,
} from '@aws-sdk/client-s3';
import { getCustomUserAgent } from '@aws/dea-app/lib/lambda-http-helpers';
import {
  Alert,
  Box,
  Button,
  Container,
  Form,
  FormField,
  Header,
  Icon,
  Input,
  Modal,
  SpaceBetween,
  Spinner,
  Table,
  Textarea,
} from '@cloudscape-design/components';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { completeUpload, initiateUpload } from '../../api/cases';
import { commonLabels, commonTableLabels, fileOperationsLabels, fileUploadLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { refreshCredentials } from '../../helpers/authService';
import { FileWithPath, formatFileSize } from '../../helpers/fileHelper';
import { InitiateUploadForm } from '../../models/CaseFiles';
import FileUpload from '../common-components/FileUpload';
import { UploadFilesProps } from './UploadFilesBody';

const MINUTES_TO_MILLISECONDS = 60 * 1000;

export interface FileUploadProgressRow {
  fileName: string;
  status: UploadStatus;
  fileSizeBytes: number;
  relativePath: string;
}

enum UploadStatus {
  progress = 'Uploading',
  complete = 'Uploaded',
  failed = 'Upload failed',
}

interface ActiveFileUpload {
  file: FileWithPath;
  uploadDto: InitiateUploadForm;
}

interface UploadStats {
  success: number;
  total: number;
}

export const ONE_MB = 1024 * 1024;
export const ONE_GB = ONE_MB * 1024;
const MAX_PARALLEL_UPLOADS = 1; // One file concurrently for now. The backend requires a code refactor to deal with the TransactionConflictException thrown ocassionally.

function UploadFilesForm(props: UploadFilesProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadProgressRow[]>([]);
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState('');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const router = useRouter();
  const { pushNotification } = useNotifications();

  async function sendUploadStatusNotification(stats: UploadStats, type: string) {
    if (uploadInProgress === false) {
      if (stats.success > 0 && type === 'success') {
        pushNotification('success', fileUploadLabels.uploadFilesSuccessLabel(stats.success));
      }
      const fail = stats.total - stats.success;
      if (fail > 0 && type === 'fail') {
        pushNotification('error', fileUploadLabels.uploadFilesFailLabel(fail));
      }
    }
  }

  async function onSubmitHandler(): Promise<UploadStats> {
    // top level try/finally to set uploadInProgress bool state
    let stat = { success: 0, total: 0 };
    try {
      setUploadInProgress(true);

      setUploadedFiles([
        ...uploadedFiles,
        ...selectedFiles.map((file) => ({
          fileName: file.name,
          fileSizeBytes: Math.max(file.size, 1),
          status: UploadStatus.progress,
          relativePath: file.relativePath,
        })),
      ]);

      let position = 0;
      while (position < selectedFiles.length) {
        const itemsForBatch: FileWithPath[] = selectedFiles.slice(position, position + MAX_PARALLEL_UPLOADS);
        const stats = (await Promise.all(itemsForBatch.map((item: FileWithPath) => uploadFile(item)))).reduce(
          (acc, item): UploadStats => {
            return {
              success: acc.success + item.success,
              total: acc.total + item.total,
            };
          },
          { success: 0, total: 0 }
        );
        stat = {
          success: stat.success + stats.success,
          total: stat.total + stats.total,
        };
        position += MAX_PARALLEL_UPLOADS;
      }

      setSelectedFiles([]);
    } finally {
      setUploadInProgress(false);
    }
    return stat;
  }

  async function blobToArrayBuffer(blob: Blob) {
    if ('arrayBuffer' in blob) {
      return await blob.arrayBuffer();
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result !== 'string') {
          resolve(reader.result);
        }
        reject();
      };
      reader.onerror = () => reject();
      reader.readAsArrayBuffer(blob);
    });
  }

  async function uploadFilePartsAndComplete(activeFileUpload: ActiveFileUpload, chunkSizeBytes: number) {
    const initiatedCaseFile = await initiateUpload(activeFileUpload.uploadDto);
    const fipsSupported = process.env.NEXT_PUBLIC_FIPS_SUPPORTED === 'true';

    let federationS3Client = new S3Client({
      credentials: initiatedCaseFile.federationCredentials,
      region: initiatedCaseFile.region,
      useFipsEndpoint: fipsSupported,
      customUserAgent: getCustomUserAgent(),
    });

    const credentialsInterval = setInterval(async () => {
      await refreshCredentials();
      const refreshRequest = await initiateUpload({
        ...activeFileUpload.uploadDto,
        uploadId: initiatedCaseFile.uploadId,
      });
      federationS3Client = new S3Client({
        useFipsEndpoint: fipsSupported,
        customUserAgent: getCustomUserAgent(),
        credentials: refreshRequest.federationCredentials,
        region: initiatedCaseFile.region,
      });
    }, 20 * MINUTES_TO_MILLISECONDS);

    const uploadPromises: Promise<UploadPartCommandOutput>[] = [];

    try {
      const totalChunks = Math.ceil(activeFileUpload.file.size / chunkSizeBytes);
      let promisesSize = 0;
      for (let i = 0; i < totalChunks; i++) {
        const chunkBlob = activeFileUpload.file.slice(i * chunkSizeBytes, (i + 1) * chunkSizeBytes);

        const arrayFromBlob = new Uint8Array(await blobToArrayBuffer(chunkBlob));
        const partHash = crypto.createHash('sha256').update(arrayFromBlob).digest('base64');

        const uploadInput: UploadPartCommandInput = {
          Bucket: initiatedCaseFile.bucket,
          Key: `${initiatedCaseFile.caseUlid}/${initiatedCaseFile.ulid}`,
          PartNumber: i + 1,
          UploadId: initiatedCaseFile.uploadId,
          Body: arrayFromBlob,
          ChecksumSHA256: partHash,
          ChecksumAlgorithm: ChecksumAlgorithm.SHA256,
        };
        const uploadCommand = new UploadPartCommand(uploadInput);

        uploadPromises.push(federationS3Client.send(uploadCommand));
        promisesSize += chunkSizeBytes;

        // flush promises if we've got over 500MB queued
        if (promisesSize > ONE_MB * 500) {
          await Promise.all(uploadPromises);
          promisesSize = 0;
          uploadPromises.length = 0;
        }
      }

      await Promise.all(uploadPromises);
    } finally {
      clearInterval(credentialsInterval);
    }

    await completeUpload({
      caseUlid: props.caseId,
      ulid: initiatedCaseFile.ulid,
      uploadId: initiatedCaseFile.uploadId,
    });
    updateFileProgress(activeFileUpload.file, UploadStatus.complete);
  }

  async function uploadFile(selectedFile: FileWithPath): Promise<UploadStats> {
    const fileSizeBytes = Math.max(selectedFile.size, 1);
    // Trying to use small chunk size (50MB) to reduce memory use.
    // Maximum object size	5 TiB
    // Maximum number of parts per upload	10,000
    // 5 MiB to 5 GiB. There is no minimum size limit on the last part of your multipart upload.
    const chunkSizeBytes = Math.max(selectedFile.size / 10_000, 50 * ONE_MB);
    // per file try/finally state to initiate uploads
    try {
      const contentType = selectedFile.type ? selectedFile.type : 'text/plain';
      const activeFileUpload = {
        file: selectedFile,
        uploadDto: {
          caseUlid: props.caseId,
          fileName: selectedFile.name,
          filePath: selectedFile.relativePath,
          fileSizeBytes,
          chunkSizeBytes,
          contentType,
          reason,
          details,
        },
      };
      await uploadFilePartsAndComplete(activeFileUpload, chunkSizeBytes);
      return { success: 1, total: 1 };
    } catch (e) {
      updateFileProgress(selectedFile, UploadStatus.failed);
      console.log('Upload failed', e);
      return { success: 0, total: 1 };
    }
  }

  function updateFileProgress(selectedFile: FileWithPath, status: UploadStatus) {
    setUploadedFiles((prev) => {
      const newList = [...prev];
      const fileToUpdateStatus = newList.find(
        (file) =>
          file.fileName === selectedFile.name &&
          file.relativePath === selectedFile.relativePath &&
          file.status === UploadStatus.progress
      );
      if (fileToUpdateStatus) {
        fileToUpdateStatus.status = status;
      }
      return newList;
    });
  }

  function statusCell(uploadProgress: FileUploadProgressRow) {
    switch (uploadProgress.status) {
      case UploadStatus.progress: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <Spinner />
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
      case UploadStatus.failed: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <span role="img" aria-label="Error">
                <Icon name="status-negative" variant="error" />
              </span>
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
      case UploadStatus.complete: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <span role="img" aria-label="Success">
                <Icon name="check" variant="success" />
              </span>
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
      default: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <span role="img" aria-label="File">
                <Icon name="file" />
              </span>
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
    }
  }

  function onDoneHandler() {
    return router.push(`/case-detail?caseId=${props.caseId}`);
  }

  function validateFields(): boolean {
    return reason.length > 1 && details.length > 1;
  }

  return (
    <SpaceBetween data-testid="upload-file-form-space" size="xxl">
      <Modal
        data-testid="upload-file-form-modal"
        onDismiss={() => setConfirmationVisible(false)}
        visible={confirmationVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmationVisible(false)}>
                Go back
              </Button>
              <Button
                data-testid="confirm-upload-button"
                variant="primary"
                onClick={async () => {
                  setConfirmationVisible(false);
                  const stats = await onSubmitHandler();
                  void sendUploadStatusNotification(stats, 'fail');
                  void sendUploadStatusNotification(stats, 'success');
                }}
              >
                Confirm
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={fileOperationsLabels.modalTitle}
      >
        <Alert statusIconAriaLabel="Warning" type="warning">
          {fileOperationsLabels.modalBody}
        </Alert>
      </Modal>
      <Form>
        <Container
          header={
            <Header variant="h2" description={fileOperationsLabels.uploadFileDescription}>
              {fileOperationsLabels.uploadDetailsLabel}
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              data-testid="input-details"
              label={fileOperationsLabels.evidenceDetailsLabel}
              description={fileOperationsLabels.evidenceDetailsDescription}
              errorText={details.length > 1 ? '' : commonLabels.requiredLength('Description')}
            >
              <Textarea
                value={details}
                onChange={({ detail: { value } }) => {
                  setDetails(value);
                }}
              />
            </FormField>
            <FormField
              data-testid="input-reason"
              label={fileOperationsLabels.uploadReasonLabel}
              description={fileOperationsLabels.uploadReasonDescription}
              errorText={
                reason.length > 1 ? '' : commonLabels.requiredLength('Reason for uploading evidence')
              }
            >
              <Input
                value={reason}
                onChange={({ detail: { value } }) => {
                  setReason(value);
                }}
              />
            </FormField>
            <FileUpload
              onChange={(files: FileWithPath[]) => setSelectedFiles(files)}
              value={selectedFiles}
              disabled={uploadInProgress}
            />
          </SpaceBetween>
        </Container>
      </Form>

      <SpaceBetween direction="horizontal" size="xs">
        <Button formAction="none" variant="link" onClick={onDoneHandler}>
          {commonLabels.doneButton}
        </Button>
        <Button
          variant="primary"
          iconAlign="right"
          data-testid="upload-file-submit"
          onClick={() => setConfirmationVisible(true)}
          disabled={uploadInProgress || !validateFields()}
        >
          {commonLabels.uploadAndSaveButton}
        </Button>
        {uploadInProgress ? <Spinner size="big" variant="disabled" /> : null}
      </SpaceBetween>
      <Container
        header={
          <Header description={fileOperationsLabels.uploadStatusDescription}>
            {fileOperationsLabels.caseFilesLabel}
          </Header>
        }
      >
        <Table
          items={uploadedFiles}
          variant="embedded"
          firstIndex={1}
          totalItemsCount={uploadedFiles.length}
          renderAriaLive={commonTableLabels.renderAriaLiveLabel}
          ariaLabels={{
            tableLabel: fileOperationsLabels.caseFilesLabel,
            selectionGroupLabel: commonTableLabels.tableCheckboxSelectionGroupLabel,
            allItemsSelectionLabel: commonTableLabels.allItemsSelectionLabel,
            itemSelectionLabel: commonTableLabels.itemSelectionLabel,
          }}
          columnDefinitions={[
            {
              id: 'fileName',
              header: commonTableLabels.nameHeader,
              cell: (e) => e.fileName,
              width: 170,
              minWidth: 165,
              sortingField: 'fileName',
            },
            {
              id: 'fileSizeBytes',
              header: commonTableLabels.fileSizeHeader,
              cell: (e) => formatFileSize(e.fileSizeBytes),
              width: 170,
              minWidth: 165,
              sortingField: 'fileSizeBytes',
            },
            {
              id: 'status',
              header: commonTableLabels.statusHeader,
              cell: statusCell,
              width: 170,
              minWidth: 165,
              maxWidth: 180,
              sortingField: 'status',
            },
          ]}
          resizableColumns
        />
      </Container>
    </SpaceBetween>
  );
}

export default UploadFilesForm;
