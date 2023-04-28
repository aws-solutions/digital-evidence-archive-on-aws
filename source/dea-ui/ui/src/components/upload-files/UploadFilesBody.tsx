/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import * as React from 'react';
import { fileOperationsLabels } from '../../common/labels';
import UploadFilesForm from './UploadFilesForm';

export interface UploadFilesProps {
  readonly caseId: string;
  readonly filePath: string;
}

function UploadFilePage(props: UploadFilesProps) {
  return (
    <ContentLayout
      data-testid="upload-file-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1">{fileOperationsLabels.uploadFileLabel}</Header>
        </SpaceBetween>
      }
    >
      <UploadFilesForm {...props}></UploadFilesForm>
    </ContentLayout>
  );
}

export default UploadFilePage;
