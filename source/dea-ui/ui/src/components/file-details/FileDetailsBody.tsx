/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileDTO, DownloadDTO } from '@aws/dea-app/lib/models/case-file';
import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import {
  Box,
  ColumnLayout,
  Container,
  ContentLayout,
  Grid,
  Header,
  SpaceBetween,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import * as React from 'react';
import {
  getCaseFileAuditCSV,
  useGetCaseActions,
  useGetCaseById,
  useGetFileDetailsById,
} from '../../api/cases';
import { auditLogLabels, caseStatusLabels, commonLabels, fileDetailLabels } from '../../common/labels';
import { formatFileSize } from '../../helpers/fileHelper';
import { canDownloadCaseAudit } from '../../helpers/userActionSupport';
import { AuditDownloadButton } from '../audit/audit-download-button';
import DownloadButton from '../common-components/DownloadButton';
import DataVaultAssociationDetailsBody from './DataVaultAssociationDetailsBody';

export interface FileDetailsBodyProps {
  readonly caseId: string;
  readonly fileId: string;
  readonly setFileName: (name: string) => void;
}

function FileDetailsBody(props: FileDetailsBodyProps): JSX.Element {
  const { setFileName } = props;
  const { data: fileData, isLoading: fileIsLoading } = useGetFileDetailsById(props.caseId, props.fileId);
  const { data: caseData, isLoading: caseIsLoading } = useGetCaseById(props.caseId);
  const userActions = useGetCaseActions(props.caseId);
  const [downloadInProgress, setDownloadInProgress] = React.useState(false);
  const [filesToRestore, setFilesToRestore] = React.useState<DownloadDTO[]>([]);

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

  React.useEffect(() => {
    if (fileData) {
      setFileName(fileData.fileName);
    }
  }, [setFileName, fileData, fileData?.fileName]);

  if (fileIsLoading || caseIsLoading) {
    return (
      <SpaceBetween size="l">
        <div></div>
        <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>
      </SpaceBetween>
    );
  } else {
    if (!fileData || !caseData) {
      return <h1>{commonLabels.notFoundLabel}</h1>;
    }

    return (
      <ContentLayout
        header={
          <Grid gridDefinition={[{ colspan: { default: 9, xxs: 3 } }, { colspan: { default: 3, xxs: 9 } }]}>
            <Header variant="h1">{fileData.fileName}</Header>
            <Box float="right">
              <SpaceBetween size="m" direction="horizontal">
                <DownloadButton
                  caseId={props.caseId}
                  caseStatus={caseData.status}
                  selectedFiles={[{ ...fileData }]}
                  selectedFilesCallback={() => void 0}
                  downloadInProgress={downloadInProgress}
                  downloadInProgressCallback={setDownloadInProgress}
                  filesToRestore={filesToRestore}
                  filesToRestoreCallback={setFilesToRestore}
                />
              </SpaceBetween>
            </Box>
          </Grid>
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
                      targetName={fileData?.fileName}
                    />
                  </SpaceBetween>
                }
              >
                {fileDetailLabels.fileDetailsLabel}
              </Header>
            }
          >
            <ColumnLayout columns={3} variant="text-grid">
              <TextContent>
                <div>
                  {' '}
                  <span>
                    <strong>{fileDetailLabels.uploadDateLabel}</strong>
                  </span>
                  <SpaceBetween size="l">
                    <p>
                      {fileData.dataVaultUploadDate
                        ? new Date(fileData.dataVaultUploadDate).toLocaleString([], {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : fileData.created
                        ? new Date(fileData.created).toLocaleString([], {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '-'}
                    </p>

                    <span>
                      <strong>{fileDetailLabels.fileSizeLabel}</strong>
                    </span>
                  </SpaceBetween>
                  <p>{formatFileSize(fileData.fileSizeBytes)}</p>
                </div>
              </TextContent>
              <TextContent>
                <div>
                  <span>
                    <strong>{commonLabels.description}</strong>
                  </span>
                  <p>{fileData.details}</p>
                </div>
              </TextContent>
              <TextContent>
                <div>
                  <span>
                    <strong>{commonLabels.statusLabel}</strong>
                  </span>
                  <SpaceBetween size="l">
                    <p>{getStatusIcon(fileData.status)}</p>
                    <span>
                      <strong>{fileDetailLabels.shaHashLabel}</strong>
                    </span>
                  </SpaceBetween>
                  <p>{fileData.sha256Hash}</p>
                </div>
              </TextContent>
            </ColumnLayout>
          </Container>
          {getDataVaultSection(fileData)}
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

export default FileDetailsBody;
