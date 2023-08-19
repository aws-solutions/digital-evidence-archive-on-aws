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
  SpaceBetween,
  Spinner,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { getCaseAuditCSV, useGetCaseActions, useGetCaseById } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { auditLogLabels, caseDetailLabels, caseStatusLabels, commonLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { canDownloadCaseAudit, canUpdateCaseDetails } from '../../helpers/userActionSupport';
import CaseDetailsTabs from './CaseDetailsTabs';

export interface CaseDetailsBodyProps {
  readonly caseId: string;
}

function CaseDetailsBody(props: CaseDetailsBodyProps): JSX.Element {
  const router = useRouter();
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const userActions = useGetCaseActions(props.caseId);
  const { data, isLoading } = useGetCaseById(props.caseId);
  const { pushNotification } = useNotifications();

  function getStatusIcon(status: CaseStatus) {
    if (status == CaseStatus.ACTIVE) {
      return <StatusIndicator>{caseStatusLabels.active}</StatusIndicator>;
    } else {
      return <StatusIndicator type="stopped">{caseStatusLabels.inactive}</StatusIndicator>;
    }
  }

  function editCaseHandler() {
    return router.push(`/edit-case?caseId=${props.caseId}`);
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
        <SpaceBetween size="xxl">
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      data-testid="download-case-audit-csv-button"
                      disabled={downloadInProgress || !canDownloadCaseAudit(userActions.data?.actions)}
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
                    <Button
                      disabled={!canUpdateCaseDetails(userActions.data?.actions)}
                      onClick={editCaseHandler}
                    >
                      {commonLabels.editButton}
                    </Button>
                  </SpaceBetween>
                }
              >
                {caseDetailLabels.caseDetailsLabel}
              </Header>
            }
          >
            <ColumnLayout columns={3} variant="text-grid">
              <TextContent>
                <div>
                  <h5>{commonLabels.creationDate}</h5>
                  <p>
                    {new Date(data.created).toLocaleString([], {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </TextContent>
              <TextContent>
                <div>
                  <h5>{commonLabels.description}</h5>
                  <p>{data.description ?? '-'}</p>
                </div>
              </TextContent>
              <TextContent>
                <div>
                  <h5>{commonLabels.statusLabel}</h5>
                  <p>{getStatusIcon(data.status)}</p>
                </div>
              </TextContent>
            </ColumnLayout>
          </Container>
          <CaseDetailsTabs
            caseId={props.caseId}
            caseStatus={data.status}
            fileCount={data.objectCount}
          ></CaseDetailsTabs>
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

const downloadCaseAudit = async (deaCase: DeaCaseDTO) => {
  const csvDownloadUrl = await getCaseAuditCSV(deaCase.ulid);
  const downloadDate = new Date();
  const alink = document.createElement('a');
  alink.href = csvDownloadUrl;
  alink.download = `CaseAudit_${deaCase.name}_${downloadDate.getFullYear()}_${
    downloadDate.getMonth() + 1
  }_${downloadDate.getDate()}_H${downloadDate.getHours()}.csv`;
  alink.click();
};

export default CaseDetailsBody;
