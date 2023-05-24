/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  Spinner,
} from '@cloudscape-design/components';
import { useState } from 'react';
import { getCaseFileAuditCSV, useGetCaseActions, useGetFileDetailsById } from '../../api/cases';
import { auditLogLabels, commonLabels, fileDetailLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatFileSize } from '../../helpers/fileHelper';
import { canDownloadCaseAudit } from '../../helpers/userActionSupport';

export interface FileDetailsBodyProps {
  readonly caseId: string;
  readonly fileId: string;
}

function FileDetailsBody(props: FileDetailsBodyProps): JSX.Element {
  const [auditDownloadInProgress, setAuditDownloadInProgress] = useState(false);
  const { data, isLoading } = useGetFileDetailsById(props.caseId, props.fileId);
  const userActions = useGetCaseActions(props.caseId);
  const { pushNotification } = useNotifications();

  async function downloadCaseFileAuditHandler() {
    try {
      setAuditDownloadInProgress(true);
      try {
        const csv = await getCaseFileAuditCSV(props.caseId, props.fileId);
        const blob = new Blob([csv], { type: 'text/csv' });
        const fileUrl = window.URL.createObjectURL(blob);
        const alink = document.createElement('a');
        alink.href = fileUrl;
        alink.download = `${data?.fileName}_Audit_${new Date().toLocaleString()}`;
        alink.click();
      } catch (e) {
        pushNotification('error', auditLogLabels.downloadCaseAuditFail(data?.fileName ?? 'file'));
        console.log(`failed to download case file audit for ${data?.fileName ?? 'unknown file'}`, e);
      }
    } finally {
      setAuditDownloadInProgress(false);
    }
  }

  if (isLoading) {
    return <h1>{commonLabels.loadingLabel}</h1>;
  } else {
    if (!data) {
      return <h1>{commonLabels.notFoundLabel}</h1>;
    }
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <Header variant="h1">{data.fileName}</Header>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">Case Details</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              {' '}
              <h4>{fileDetailLabels.uploadDateLabel}</h4>
              <p>{data.created ? new Date(data.created).toLocaleString() : '-'}</p>
            </div>
            <div>
              <h4>{commonLabels.description}</h4>
              <p>{data.details}</p>
            </div>
            <div>
              {' '}
              <h4>{auditLogLabels.caseAuditLogLabel}</h4>
              <Button
                data-testid="file-detail-download-case-audit-csv-button"
                disabled={auditDownloadInProgress || !canDownloadCaseAudit(userActions.data?.actions)}
                variant="link"
                onClick={downloadCaseFileAuditHandler}
              >
                {auditLogLabels.downloadFileAuditLabel}
                {auditDownloadInProgress ? <Spinner /> : null}
              </Button>
            </div>

            <div>
              <h4>{commonLabels.statusLabel}</h4>
              <p>{data.status}</p>
            </div>
            <div>
              <h4>{fileDetailLabels.fileSizeLabel}</h4>
              <p>{formatFileSize(data.fileSizeBytes)}</p>
            </div>
            <div>
              <h4>{fileDetailLabels.shaHashLabel}</h4>
              <p>{data.sha256Hash}</p>
            </div>
          </ColumnLayout>
        </Container>
      </ContentLayout>
    );
  }
}

export default FileDetailsBody;
