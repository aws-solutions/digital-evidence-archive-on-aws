/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileDTO } from '@aws/dea-app/lib/models/case-file';
import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import {
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import { getCaseFileAuditCSV, useGetCaseActions, useGetFileDetailsById } from '../../api/cases';
import {
  auditLogLabels,
  breadcrumbLabels,
  caseStatusLabels,
  commonLabels,
  fileDetailLabels,
} from '../../common/labels';
import { formatFileSize } from '../../helpers/fileHelper';
import { canDownloadCaseAudit } from '../../helpers/userActionSupport';
import { AuditDownloadButton } from '../audit/audit-download-button';
import DataVaultAssociationDetailsBody from './DataVaultAssociationDetailsBody';

export interface FileDetailsBodyProps {
  readonly caseId: string;
  readonly fileId: string;
}

function FileDetailsBody(props: FileDetailsBodyProps): JSX.Element {
  const { data, isLoading } = useGetFileDetailsById(props.caseId, props.fileId);
  const userActions = useGetCaseActions(props.caseId);

  function getStatusIcon(status: string) {
    if (status == CaseFileStatus.ACTIVE) {
      return <StatusIndicator>{caseStatusLabels.active}</StatusIndicator>;
    } else {
      return <StatusIndicator type="stopped">{caseStatusLabels.inactive}</StatusIndicator>;
    }
  }

  function getDataVaultSection(data: CaseFileDTO | undefined) {
    if (!data?.dataVaultUlid) {
      return;
    } else {
      const dataVaultData = {
        dataVaultUlid: data.dataVaultUlid,
        dataVaultName: data.dataVaultName ? data.dataVaultName : data.dataVaultUlid,
        executionId: data.executionId ? data.executionId : '-',
        associationCreatedBy: data.associationCreatedBy ? data.associationCreatedBy : '-',
        associationDate: data.associationDate,
      };
      return <DataVaultAssociationDetailsBody {...dataVaultData} />;
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
        <SpaceBetween size="xxl">
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <AuditDownloadButton
                      label={auditLogLabels.caseFileAuditLogLabel}
                      testId="download-case-file-audit-button"
                      permissionCallback={() => canDownloadCaseAudit(userActions.data?.actions)}
                      downloadCallback={async () => await getCaseFileAuditCSV(props.caseId, props.fileId)}
                      type="CaseFileAudit"
                      targetName={data?.fileName}
                    />
                  </SpaceBetween>
                }
              >
                {breadcrumbLabels.fileDetailsLabel}
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
                      {data.dataVaultUploadDate
                        ? new Date(data.dataVaultUploadDate).toLocaleString([], {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : data.created
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
          {getDataVaultSection(data)}
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

export default FileDetailsBody;
