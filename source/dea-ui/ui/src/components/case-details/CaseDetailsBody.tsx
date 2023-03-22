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
import { getCaseAuditCSV, useGetCaseById } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { auditLogLabels, commonLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import CaseDetailsTabs from './CaseDetailsTabs';

export interface CaseDetailsBodyProps {
  readonly caseId: string;
}

function CaseDetailsBody(props: CaseDetailsBodyProps): JSX.Element {
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const { data, isLoading } = useGetCaseById(props.caseId);
  const { pushNotification } = useNotifications();
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
                disabled={downloadInProgress}
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
        </Container>
        <CaseDetailsTabs caseId={props.caseId}></CaseDetailsTabs>
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
