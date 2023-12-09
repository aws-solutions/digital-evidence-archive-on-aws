/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { InitiateCaseFileUploadDTO } from '@aws/dea-app/lib/models/case-file';
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
import cryptoJS from 'crypto-js';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { completeUpload, initiateUpload } from '../../api/cases';
import { commonLabels, commonTableLabels, fileOperationsLabels } from '../../common/labels';
import { refreshCredentials } from '../../helpers/authService';
import { FileWithPath, formatFileSize } from '../../helpers/fileHelper';
import FileUpload from '../common-components/FileUpload';
import { UploadFilesProps } from './UploadFilesBody';

interface FileUploadProgressRow {
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

interface UploadDetails {
  caseUlid: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  chunkSizeBytes: number;
  contentType: string;
  reason: string;
  details: string;
}

interface ActiveFileUpload {
  file: FileWithPath;
  caseFileUploadDetails: UploadDetails;
}

export const ONE_MB = 1024 * 1024;
const MAX_PARALLEL_PART_UPLOADS = 10;
const MAX_PARALLEL_UPLOADS = 1; // One file concurrently for now. The backend requires a code refactor to deal with the TransactionConflictException thrown ocassionally.

function UploadFilesForm(props: UploadFilesProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadProgressRow[]>([]);
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState('');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const router = useRouter();

  async function onSubmitHandler() {
    // top level try/finally to set uploadInProgress bool state
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
        const itemsForBatch = selectedFiles.slice(position, position + MAX_PARALLEL_UPLOADS);
        await Promise.all(itemsForBatch.map((item) => uploadFile(item)));
        position += MAX_PARALLEL_UPLOADS;
      }

      setSelectedFiles([]);
    } finally {
      setUploadInProgress(false);
    }
  }

  async function uploadFilePartsAndComplete(activeFileUpload: ActiveFileUpload) {
    const chunkSizeBytes = activeFileUpload.caseFileUploadDetails.chunkSizeBytes;
    const totalChunks = Math.ceil(activeFileUpload.caseFileUploadDetails.fileSizeBytes / chunkSizeBytes);
    let uploadId: string | undefined = undefined;
    const hash = cryptoJS.algo.SHA256.create();
    for (let rangeStart = 1; rangeStart <= totalChunks; rangeStart += MAX_PARALLEL_PART_UPLOADS) {
      const rangeEnd = rangeStart + (MAX_PARALLEL_PART_UPLOADS - 1);
      const uploadDto: InitiateCaseFileUploadDTO = {
        ...activeFileUpload.caseFileUploadDetails,
        // range is inclusive
        partRangeStart: rangeStart,
        partRangeEnd: Math.min(rangeEnd, totalChunks),
        uploadId,
      };

      const initiatedCaseFile = await initiateUpload(uploadDto);
      uploadId = initiatedCaseFile.uploadId;

      if (!initiatedCaseFile.presignedUrls) {
        throw new Error('No presigned urls provided');
      }

      const uploadPromises: Promise<Response>[] = [];
      const chunkBatchOffset = rangeStart - 1; //minus one because the range starts with 1
      for (let index = 0; index < initiatedCaseFile.presignedUrls.length; index += 1) {
        const url = initiatedCaseFile.presignedUrls[index];
        const start = (chunkBatchOffset + index) * chunkSizeBytes;
        const end = (chunkBatchOffset + index + 1) * chunkSizeBytes;
        const totalIndex = rangeStart + index;
        let filePartPointer: Blob;
        if (totalIndex === totalChunks) {
          filePartPointer = activeFileUpload.file.slice(start);
        } else {
          filePartPointer = activeFileUpload.file.slice(start, end);
        }
        const loadedFilePart = await readFileSlice(filePartPointer);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore. WordArray expects number[] which should be satisfied by Uint8Array
        hash.update(cryptoJS.lib.WordArray.create(loadedFilePart));
        uploadPromises.push(fetch(url, { method: 'PUT', body: loadedFilePart }));
      }
      await Promise.all(uploadPromises);
      await refreshCredentials();

      if (rangeEnd >= totalChunks) {
        await completeUpload({
          caseUlid: props.caseId,
          ulid: initiatedCaseFile.ulid,
          uploadId,
          sha256Hash: hash.finalize().toString(),
        });
      }
    }
    updateFileProgress(activeFileUpload.file, UploadStatus.complete);
  }

  async function uploadFile(selectedFile: FileWithPath) {
    const fileSizeBytes = Math.max(selectedFile.size, 1);
    // Trying to use small chunk size (50MB) to reduce memory use.
    // However, since S3 allows a max of 10,000 parts for multipart uploads, we will increase chunk size for larger files
    const chunkSizeBytes = Math.max(selectedFile.size / 10_000, 50 * ONE_MB);
    // per file try/finally state to initiate uploads
    try {
      const contentType = selectedFile.type ? selectedFile.type : 'text/plain';
      const activeFileUpload: ActiveFileUpload = {
        file: selectedFile,
        caseFileUploadDetails: {
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
      await uploadFilePartsAndComplete(activeFileUpload);
    } catch (e) {
      updateFileProgress(selectedFile, UploadStatus.failed);
      console.log('Upload failed', e);
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

  async function readFileSlice(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is of type <string | ArrayBuffer | null>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        resolve(new Uint8Array(reader.result as any));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
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
              <Icon name="status-negative" variant="error" />
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
      case UploadStatus.complete: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <Icon name="check" variant="success" />
              <span> {uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
      default: {
        return (
          <Box>
            <SpaceBetween direction="horizontal" size="xs" key={uploadProgress.fileName}>
              <Icon name="file" />
              <span>{uploadProgress.status}</span>
            </SpaceBetween>
          </Box>
        );
      }
    }
  }

  function onDoneHandler() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push(`/case-detail?caseId=${props.caseId}`);
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
                onClick={() => {
                  void onSubmitHandler();
                  setConfirmationVisible(false);
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
              errorText={details.length > 1 ? '' : commonLabels.requiredLength}
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
              errorText={reason.length > 1 ? '' : commonLabels.requiredLength}
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
          columnDefinitions={[
            {
              id: 'name',
              header: commonTableLabels.nameHeader,
              cell: (e) => e.fileName,
              width: 170,
              minWidth: 165,
              sortingField: 'fileName',
            },
            {
              id: 'size',
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
