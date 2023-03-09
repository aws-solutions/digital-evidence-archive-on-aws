/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import * as React from 'react';
import { fileOperationsLabels } from '../../common/labels';
import UploadFileForm from './UploadFileForm';

interface UploadFileProps {
  readonly caseId: string;
}

function UploadFilePage(props: UploadFileProps) {
  return (
    <ContentLayout
      data-testid="upload-file-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1">{fileOperationsLabels.uploadFileLabel}</Header>
        </SpaceBetween>
      }
    >
      <UploadFileForm caseId={props.caseId}></UploadFileForm>
    </ContentLayout>
  );
}

export default UploadFilePage;
