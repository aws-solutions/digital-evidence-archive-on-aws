/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import {
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import { useState } from 'react';
import { getCaseFileAuditCSV, useGetCaseActions, useGetFileDetailsById } from '../../api/cases';
import {
  auditLogLabels,
  breadcrumbLabels,
  caseStatusLabels,
  commonLabels,
  fileDetailLabels,
} from '../../common/labels';
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

  function getStatusIcon(status: string) {
    if (status == CaseFileStatus.ACTIVE) {
      return <StatusIndicator>{caseStatusLabels.active}</StatusIndicator>;
    } else {
      return <StatusIndicator type="stopped">{caseStatusLabels.inactive}</StatusIndicator>;
    }
  }

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
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    data-testid="download-case-file-audit-button"
                    onClick={downloadCaseFileAuditHandler}
                    disabled={auditDownloadInProgress || !canDownloadCaseAudit(userActions.data?.actions)}
                  >
                    {auditLogLabels.caseFileAuditLogLabel}
                    {auditDownloadInProgress ? <Spinner size="big" /> : null}
                  </Button>
                </SpaceBetween>
              }
            >
              {breadcrumbLabels.fileDetailsLabel}
              {auditDownloadInProgress ? <Spinner size="big" /> : null}
            </Header>
          }
        >
          <ColumnLayout columns={3} variant="text-grid">
            <TextContent>
              <div>
                {' '}
                <h5>{fileDetailLabels.uploadDateLabel}</h5>
                <SpaceBetween size="l">
                  <p>
                    {data.created
                      ? new Date(data.created).toLocaleString([], {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>

                  <h5>{fileDetailLabels.fileSizeLabel}</h5>
                </SpaceBetween>
                <p>{formatFileSize(data.fileSizeBytes)}</p>
              </div>
            </TextContent>
            <TextContent>
              <div>
                <h5>{commonLabels.description}</h5>
                <p>{data.details}</p>
              </div>
            </TextContent>
            <TextContent>
              <div>
                <h5>{commonLabels.statusLabel}</h5>
                <SpaceBetween size="l">
                  <p>{getStatusIcon(data.status)}</p>

                  <h5>{fileDetailLabels.shaHashLabel}</h5>
                </SpaceBetween>
                <p>{data.sha256Hash}</p>
              </div>
            </TextContent>
          </ColumnLayout>
        </Container>
      </ContentLayout>
    );
  }
}

export default FileDetailsBody;
