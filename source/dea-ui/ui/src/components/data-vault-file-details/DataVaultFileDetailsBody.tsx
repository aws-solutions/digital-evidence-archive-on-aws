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
  TextContent,
} from '@cloudscape-design/components';
import { useGetDataVaultFileDetailsById } from '../../api/data-vaults';
import {
  auditLogLabels,
  breadcrumbLabels,
  commonLabels,
  commonTableLabels,
  dataVaultDetailLabels,
  fileDetailLabels,
} from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';

export interface DataVaultFileDetailsBodyProps {
  readonly dataVaultId: string;
  readonly fileId: string;
}

function DataVaultFileDetailsBody(props: DataVaultFileDetailsBodyProps): JSX.Element {
  const { data, isLoading } = useGetDataVaultFileDetailsById(props.dataVaultId, props.fileId);

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
                    <Button data-testid="download-data-vault-file-audit-button" disabled={true}>
                      {auditLogLabels.downloadFileAuditLabel}
                    </Button>
                  </SpaceBetween>
                }
              >
                {breadcrumbLabels.fileDetailsLabel}
              </Header>
            }
          >
            <ColumnLayout columns={3} variant="text-grid">
              <TextContent>
                <h5>{fileDetailLabels.uploadDateLabel}</h5>
                <SpaceBetween size="l">
                  <p>{formatDateFromISOString(data.updated?.toString())}</p>
                </SpaceBetween>
              </TextContent>
              <TextContent>
                <h5>{fileDetailLabels.fileSizeLabel}</h5>
                <SpaceBetween size="l">
                  <p>{formatFileSize(data.fileSizeBytes)}</p>
                </SpaceBetween>
              </TextContent>
              <TextContent>
                <h5>{fileDetailLabels.shaHashLabel}</h5>
                <SpaceBetween size="l">
                  <p>{data.sha256Hash}</p>
                </SpaceBetween>
              </TextContent>
            </ColumnLayout>
          </Container>
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button data-testid="disassociate-data-vault-file-button" disabled={true}>
                      {dataVaultDetailLabels.disassociateLabel}
                    </Button>
                  </SpaceBetween>
                }
              >
                {breadcrumbLabels.dataVaultDetailsLabel}
              </Header>
            }
          >
            <ColumnLayout columns={2} variant="text-grid">
              <TextContent>
                <div>
                  <SpaceBetween size="l">
                    <h5>{commonTableLabels.executionIdHeader}</h5>
                  </SpaceBetween>
                  <p>{data.executionId}</p>
                </div>
              </TextContent>
              <TextContent>
                <div>
                  <SpaceBetween size="l">
                    <h5>{commonTableLabels.caseAssociationHeader}</h5>
                  </SpaceBetween>
                  <p>-</p>
                </div>
              </TextContent>
            </ColumnLayout>
          </Container>
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

export default DataVaultFileDetailsBody;
