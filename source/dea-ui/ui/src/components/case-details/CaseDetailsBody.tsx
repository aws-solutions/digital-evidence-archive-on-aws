/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import {
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  Icon,
  SpaceBetween,
  Spinner,
} from '@cloudscape-design/components';
import * as React from 'react';
import { useState } from 'react';
import { getCaseAuditCSV, useGetCaseActions, useGetCaseById } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { auditLogLabels, commonLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { canDownloadCaseAudit } from '../../helpers/userActionSupport';
import CaseDetailsTabs from './CaseDetailsTabs';

export interface CaseDetailsBodyProps {
  readonly caseId: string;
}

function CaseDetailsBody(props: CaseDetailsBodyProps): JSX.Element {
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const userActions = useGetCaseActions(props.caseId);
  const { data, isLoading } = useGetCaseById(props.caseId);
  const { pushNotification } = useNotifications();

  function getStatusIcon(status: CaseStatus) {
    if (status == CaseStatus.ACTIVE) {
      return <Icon name="check" variant="success" />;
    } else {
      return <Icon name="status-stopped" variant="disabled" />;
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
            <Header variant="h1">{data.name}</Header>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">Case Details</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              {' '}
              <h4>{commonLabels.creationDate}</h4>
              <p>{new Date(data.created).toLocaleString()}</p>
            </div>
            <div>
              <h4>{commonLabels.description}</h4>
              <p>{data.description}</p>
            </div>
            <div>
              {' '}
              <h4>{auditLogLabels.caseAuditLogLabel}</h4>
              <Button
                data-testid="download-case-audit-csv-button"
                disabled={downloadInProgress || !canDownloadCaseAudit(userActions.data?.actions)}
                variant="link"
                onClick={async () => {
                  setDownloadInProgress(true);
                  try {
                    await downloadCaseAudit(data);
                  } catch (e) {
                    pushNotification('error', auditLogLabels.errorLabel);
                  } finally {
                    setDownloadInProgress(false);
                  }
                }}
              >
                {auditLogLabels.downloadCSVLabel}
                {downloadInProgress ? <Spinner /> : null}
              </Button>
            </div>
          </ColumnLayout>
          <ColumnLayout columns={1} variant="text-grid">
            <div>
              <h4>{commonLabels.statusLabel}</h4>
              <p>
                {getStatusIcon(data.status)} {data.status.slice(0, 1) + data.status.slice(1).toLowerCase()}
              </p>
            </div>
          </ColumnLayout>
        </Container>
        <CaseDetailsTabs caseId={props.caseId} caseStatus={data.status}></CaseDetailsTabs>
      </ContentLayout>
    );
  }
}

const downloadCaseAudit = async (deaCase: DeaCaseDTO) => {
  const csv = await getCaseAuditCSV(deaCase.ulid);
  const blob = new Blob([csv], { type: 'text/csv' });
  const fileUrl = window.URL.createObjectURL(blob);
  const alink = document.createElement('a');
  alink.href = fileUrl;
  alink.download = `${deaCase.name}_Audit_${new Date().toLocaleString()}`;
  alink.click();
};

export default CaseDetailsBody;
