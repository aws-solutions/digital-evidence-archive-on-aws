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
  Link,
  SpaceBetween,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/navigation';
import { getCaseAuditCSV, useGetCaseActions } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { auditLogLabels, caseDetailLabels, caseStatusLabels, commonLabels } from '../../common/labels';
import { useHelp } from '../../context/HelpContext';
import { canDownloadCaseAudit, canUpdateCaseDetails } from '../../helpers/userActionSupport';
import { AuditDownloadButton } from '../audit/audit-download-button';
import CaseDetailsTabs from './CaseDetailsTabs';

export interface CaseDetailsBodyProps {
  readonly caseId: string;
  readonly data: DeaCaseDTO;
}

function CaseDetailsBody(props: CaseDetailsBodyProps): JSX.Element {
  const router = useRouter();
  const userActions = useGetCaseActions(props.caseId);
  const caseName = props.data.name;
  const { makeHelpPanelHandler } = useHelp();

  function getStatusIcon(status: CaseStatus) {
    if (status == CaseStatus.ACTIVE) {
      return <StatusIndicator>{caseStatusLabels.active}</StatusIndicator>;
    } else {
      return <StatusIndicator type="stopped">{caseStatusLabels.inactive}</StatusIndicator>;
    }
  }

  function editCaseHandler() {
    return router.push(`/edit-case?caseId=${props.caseId}&caseName=${caseName}`);
  }

  if (!props.data) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const data = props.data;

  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            info={<Link onFollow={makeHelpPanelHandler('case-details-page')}>{commonLabels.infoLabel}</Link>}
          >
            {props.data.name}
          </Header>
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
                  <AuditDownloadButton
                    label={auditLogLabels.downloadCSVLabel}
                    testId="download-case-audit-csv-button"
                    permissionCallback={() => canDownloadCaseAudit(userActions.data?.actions)}
                    downloadCallback={async () => await getCaseAuditCSV(data.ulid)}
                    type="CaseAudit"
                    targetName={data.name}
                  />
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
                <span>
                  <strong>{commonLabels.creationDate}</strong>
                </span>
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
                <span>
                  <strong>{commonLabels.description}</strong>
                </span>
                <p>{data.description ?? '-'}</p>
              </div>
            </TextContent>
            <TextContent>
              <div>
                <span>
                  <strong>{commonLabels.statusLabel}</strong>
                </span>
                <p>{getStatusIcon(data.status)}</p>
              </div>
            </TextContent>
          </ColumnLayout>
        </Container>
        <CaseDetailsTabs
          caseId={props.caseId}
          caseStatus={data.status}
          fileCount={data.objectCount}
          caseName={data.name}
        ></CaseDetailsTabs>
      </SpaceBetween>
    </ContentLayout>
  );
}

export default CaseDetailsBody;
