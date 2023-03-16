/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app';
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
} from '@cloudscape-design/components';
import sha256 from 'crypto-js/sha256';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import { initiateUpload, completeUpload } from '../../api/cases';
import { commonLabels, fileOperationsLabels } from '../../common/labels';
import { UploadFilesProps } from './UploadFilesBody';

function UploadFilesForm(props: UploadFilesProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const router = useRouter();

  async function onSubmitHandler() {
    if (selectedFile) {
      try {
        setUploadInProgress(true);
        const contentType = selectedFile.type ? selectedFile.type : 'text/plain';
        const initiatedCaseFile: DeaCaseFile = await initiateUpload({
          caseUlid: props.caseId,
          fileName: selectedFile.name,
          filePath: props.filePath,
          fileSizeMb: Math.ceil(Math.max(selectedFile.size, 1) / 1_000_000),
          contentType,
        });

        // TODO: This needs to be configurable.
        // NOTE: UI + Backend need to have matching values
        const fileChunkSize = 500_000_000;

        const uploadPromises: Promise<Response>[] = [];
        if (initiatedCaseFile && initiatedCaseFile.presignedUrls) {
          const numberOfUrls = initiatedCaseFile.presignedUrls.length;
          initiatedCaseFile.presignedUrls.forEach((url, index) => {
            const start = index * fileChunkSize;
            const end = (index + 1) * fileChunkSize;
            const filePart =
              index === numberOfUrls - 1 ? selectedFile.slice(start) : selectedFile.slice(start, end);
            uploadPromises[index] = fetch(url, { method: 'PUT', body: filePart });
          });

          await Promise.all(uploadPromises);

          await completeUpload({
            caseUlid: props.caseId,
            ulid: initiatedCaseFile.ulid,
            uploadId: initiatedCaseFile.uploadId,
            // TODO: we should calculate hash in parts while uploading parts
            sha256Hash: sha256(await selectedFile.text()).toString(),
          });
        }
      } finally {
        setUploadInProgress(false);
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
              label={fileOperationsLabels.evidenceDetailsLabel}
              description={fileOperationsLabels.evidenceDetailsDescription}
            >
              <Textarea
                value={description}
                onChange={({ detail: { value } }) => {
                  setDescription(value);
                }}
              />
            </FormField>
            <FormField
              data-testid="input-reason"
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
                  data-testid="file-select"
                  onChange={(event) => {
                    if (event.currentTarget && event.currentTarget.files) {
                      setSelectedFile(event.currentTarget.files[0]);
                    }
                  }}
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
          disabled={uploadInProgress}
        >
          {commonLabels.uploadButton}
        </Button>
        {uploadInProgress ? <Spinner size="big" /> : null}
      </SpaceBetween>
    </SpaceBetween>
  );
}

export default UploadFilesForm;
