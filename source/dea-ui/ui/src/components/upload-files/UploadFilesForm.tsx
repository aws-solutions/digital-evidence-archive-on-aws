/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
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
import { FileWithPath, formatFileSize } from '../../helpers/fileHelper';
import FileUpload from '../common-components/FileUpload';
import { UploadFilesProps } from './UploadFilesBody';

interface FileUploadProgressRow {
  fileName: string;
  status: UploadStatus;
  fileSizeBytes: number;
}

enum UploadStatus {
  progress = 'Uploading',
  complete = 'Uploaded',
  failed = 'Upload failed',
}

interface ActiveFileUpload {
  fileUploadProgress: FileUploadProgressRow;
  file: File;
  initiatedCaseFilePromise: Promise<DeaCaseFile>;
}

export const ONE_MB = 1024 * 1024;

function UploadFilesForm(props: UploadFilesProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
  const [uploadedFiles] = useState<FileUploadProgressRow[]>([]);
  const [tag, setTag] = useState('');
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState('');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const router = useRouter();

  async function onSubmitHandler() {
    // top level try/finally to set uploadInProgress bool state
    try {
      setUploadInProgress(true);
      const activeFileUploads: ActiveFileUpload[] = [];
      for (const selectedFile of selectedFiles) {
        const fileSizeBytes = Math.max(selectedFile.size, 1);
        // Trying to use small chunk size (50MB) to reduce memory use.
        // However, since S3 allows a max of 10,000 parts for multipart uploads, we will increase chunk size for larger files
        const chunkSizeBytes = Math.max(selectedFile.size / 10_000, 50 * ONE_MB);
        const uploadingFile = { fileName: selectedFile.name, fileSizeBytes, status: UploadStatus.progress };
        // per file try/finally state to initiate uploads
        try {
          uploadedFiles.push(uploadingFile);
          const contentType = selectedFile.type ? selectedFile.type : 'text/plain';
          const initiatedCaseFilePromise = initiateUpload({
            caseUlid: props.caseId,
            fileName: selectedFile.name,
            filePath: selectedFile.relativePath,
            fileSizeBytes,
            chunkSizeBytes,
            contentType,
            tag,
            reason,
            details,
          });
          activeFileUploads.push({
            file: selectedFile,
            fileUploadProgress: uploadingFile,
            initiatedCaseFilePromise,
          });
        } catch (e) {
          uploadingFile.status = UploadStatus.failed;
          console.log('Upload failed', e);
        }
      }

      setSelectedFiles([]);

      for (const activeFileUpload of activeFileUploads) {
        // per file try/finally state to upload to s3
        try {
          await finalizeFileUpload(activeFileUpload);
        } catch (e) {
          activeFileUpload.fileUploadProgress.status = UploadStatus.failed;
          console.log('Upload failed', e);
        }
      }
    } finally {
      setUploadInProgress(false);
    }
  }

  async function finalizeFileUpload(activeFileUpload: ActiveFileUpload) {
    const initiatedCaseFile = await activeFileUpload.initiatedCaseFilePromise;
    const uploadPromises: Promise<Response>[] = [];
    const hash = cryptoJS.algo.SHA256.create();
    if (initiatedCaseFile && initiatedCaseFile.presignedUrls) {
      const numberOfUrls = initiatedCaseFile.presignedUrls.length;
      const chunkSizeBytes = initiatedCaseFile.chunkSizeBytes
        ? initiatedCaseFile.chunkSizeBytes
        : 50 * ONE_MB;
      for (let index = 0; index < initiatedCaseFile.presignedUrls.length; index += 1) {
        const url = initiatedCaseFile.presignedUrls[index];
        const start = index * chunkSizeBytes;
        const end = (index + 1) * chunkSizeBytes;
        const filePartPointer =
          index === numberOfUrls - 1
            ? activeFileUpload.file.slice(start)
            : activeFileUpload.file.slice(start, end);
        const loadedFilePart = await readFileSlice(filePartPointer);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore. WordArray expects number[] which should be satisfied by Uint8Array
        hash.update(cryptoJS.lib.WordArray.create(loadedFilePart));
        uploadPromises[index] = fetch(url, { method: 'PUT', body: loadedFilePart });
      }
      await Promise.all(uploadPromises);

      await completeUpload({
        caseUlid: props.caseId,
        ulid: initiatedCaseFile.ulid,
        uploadId: initiatedCaseFile.uploadId,
        sha256Hash: hash.finalize().toString(),
      });
    }
    activeFileUpload.fileUploadProgress.status = UploadStatus.complete;
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
    return reason.length > 1 && tag.length > 1 && details.length > 1;
  }

  return (
    <SpaceBetween data-testid="upload-file-form-space" size="s">
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
              data-testid="input-tag"
              label={fileOperationsLabels.evidenceTagLabel}
              description={fileOperationsLabels.evidenceTagDescription}
              errorText={tag.length > 1 ? '' : commonLabels.requiredLength}
            >
              <Input
                value={tag}
                onChange={({ detail: { value } }) => {
                  setTag(value);
                }}
              />
            </FormField>
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
