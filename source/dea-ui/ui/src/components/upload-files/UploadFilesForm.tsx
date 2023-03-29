/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import {
  Form,
  SpaceBetween,
  Button,
  Header,
  Container,
  FormField,
  Input,
  Textarea,
  Spinner,
  Table,
  Box,
  Icon,
} from '@cloudscape-design/components';
import cryptoJS from 'crypto-js';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import { initiateUpload, completeUpload } from '../../api/cases';
import { commonLabels, commonTableLabels, fileOperationsLabels } from '../../common/labels';
import { UploadFilesProps } from './UploadFilesBody';

interface FileUploadProgressRow {
  fileName: string;
  status: UploadStatus;
  fileSizeMb: number;
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

const ONE_MB = 1024 * 1024;

function UploadFilesForm(props: UploadFilesProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles] = useState<FileUploadProgressRow[]>([]);
  const [tag, setTag] = useState('');
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState('');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const router = useRouter();

  async function onSubmitHandler() {
    // top level try/finally to set uploadInProgress bool state
    try {
      setUploadInProgress(true);
      const activeFileUploads: ActiveFileUpload[] = [];
      for (const selectedFile of selectedFiles) {
        const fileSizeMb = Math.ceil(Math.max(selectedFile.size, 1) / ONE_MB);
        // Trying to use small chunk size (50MB) to reduce memory use.
        // However, since S3 allows a max of 10,000 parts for multipart uploads, we will increase chunk size for larger files
        const chunkSizeMb = Math.max(selectedFile.size / 10_000 / ONE_MB, 50 * ONE_MB);
        const uploadingFile = { fileName: selectedFile.name, fileSizeMb, status: UploadStatus.progress };
        // per file try/finally state to initiate uploads
        try {
          uploadedFiles.push(uploadingFile);
          const contentType = selectedFile.type ? selectedFile.type : 'text/plain';
          const initiatedCaseFilePromise = initiateUpload({
            caseUlid: props.caseId,
            fileName: selectedFile.name,
            filePath: props.filePath,
            fileSizeMb,
            chunkSizeMb,
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
          const initiatedCaseFile = await activeFileUpload.initiatedCaseFilePromise;
          const uploadPromises: Promise<Response>[] = [];
          const hash = cryptoJS.algo.SHA256.create();
          if (initiatedCaseFile && initiatedCaseFile.presignedUrls) {
            const numberOfUrls = initiatedCaseFile.presignedUrls.length;
            const chunkSizeBytes = initiatedCaseFile.chunkSizeMb
              ? initiatedCaseFile.chunkSizeMb * ONE_MB
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
        } catch (e) {
          activeFileUpload.fileUploadProgress.status = UploadStatus.failed;
          console.log('Upload failed', e);
        }
      }
    } finally {
      setUploadInProgress(false);
    }
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

  function onCancelHandler() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push(`/case-detail?caseId=${props.caseId}`);
  }

  return (
    <SpaceBetween data-testid="upload-file-form-space" size="s">
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
              errorText={tag ? '' : 'Tag is required.'}
              label={fileOperationsLabels.evidenceTagLabel}
              description={fileOperationsLabels.evidenceTagDescription}
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
              errorText={details ? '' : 'Description is required.'}
              label={fileOperationsLabels.evidenceDetailsLabel}
              description={fileOperationsLabels.evidenceDetailsDescription}
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
              errorText={reason ? '' : 'Reason is required.'}
              label={fileOperationsLabels.uploadReasonLabel}
              description={fileOperationsLabels.uploadReasonDescription}
            >
              <Input
                value={reason}
                onChange={({ detail: { value } }) => {
                  setReason(value);
                }}
              />
            </FormField>
            <Container>
              <FormField
                label={fileOperationsLabels.selectFileDescription}
                description={fileOperationsLabels.selectFileSubtext}
              >
                <input
                  type="file"
                  multiple
                  data-testid="file-select"
                  onChange={(event) => {
                    if (event.currentTarget && event.currentTarget.files) {
                      selectedFiles.push(...event.currentTarget.files);
                    }
                  }}
                  disabled={uploadInProgress}
                />
              </FormField>
            </Container>
          </SpaceBetween>
        </Container>
      </Form>

      <SpaceBetween direction="horizontal" size="xs">
        <Button formAction="none" variant="link" data-testid="upload-file-cancel" onClick={onCancelHandler}>
          {commonLabels.cancelButton}
        </Button>
        <Button
          variant="primary"
          iconAlign="right"
          data-testid="upload-file-submit"
          onClick={onSubmitHandler}
          disabled={uploadInProgress || !reason || !tag || !details}
        >
          {commonLabels.uploadButton}
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
              cell: (e) => `${e.fileSizeMb}MB`,
              width: 170,
              minWidth: 165,
              sortingField: 'fileSizeMb',
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
