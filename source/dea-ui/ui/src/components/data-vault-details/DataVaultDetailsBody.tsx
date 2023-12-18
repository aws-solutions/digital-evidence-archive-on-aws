/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Box,
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  Popover,
  SpaceBetween,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useAvailableEndpoints } from '../../api/auth';
import { getDataVaultAuditCSV, useGetDataVaultById } from '../../api/data-vaults';
import { auditLogLabels, commonLabels, dataVaultDetailLabels } from '../../common/labels';
import { formatDateTimeFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import { AuditDownloadButton } from '../audit/audit-download-button';
import DataVaultFilesTable from './DataVaultFilesTable';

export const DATA_VAULTS_PUT_ENDPOINT = '/datavaults/{dataVaultId}/detailsPUT';
export const DATA_VAULTS_AUDIT_ENDPOINT = '/datavaults/{dataVaultId}/auditPOST';
export const DOWNLOAD_AUDIT_TEST_ID = 'download-datavault-audit-csv-button';
export interface DataVaultDetailsBodyProps {
  readonly dataVaultId: string;
}

function DataVaultDetailsBody(props: DataVaultDetailsBodyProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data, isLoading } = useGetDataVaultById(props.dataVaultId);

  function editHandler() {
    return router.push(`/edit-data-vault?dataVaultId=${props.dataVaultId}`);
  }

  if (isLoading) {
    return (
      <SpaceBetween size="l">
        <div></div>
        <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>
      </SpaceBetween>
    );
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
                    <AuditDownloadButton
                      label={auditLogLabels.dataVaultAuditLogLabel}
                      testId={DOWNLOAD_AUDIT_TEST_ID}
                      permissionCallback={() => availableEndpoints.data?.includes(DATA_VAULTS_AUDIT_ENDPOINT)}
                      downloadCallback={async () => await getDataVaultAuditCSV(data.ulid)}
                      type="DataVault"
                      targetName={data.name}
                    />
                    <Button
                      disabled={!availableEndpoints.data?.includes(DATA_VAULTS_PUT_ENDPOINT)}
                      onClick={editHandler}
                    >
                      {commonLabels.editButton}
                    </Button>
                  </SpaceBetween>
                }
              >
                {dataVaultDetailLabels.dataVaultDetailsLabel}
              </Header>
            }
          >
            <ColumnLayout columns={3} variant="text-grid">
              <SpaceBetween size="m">
                <TextContent>
                  <h5>{commonLabels.creationDate}</h5>
                  <p>{formatDateTimeFromISOString(data.created?.toString())}</p>
                </TextContent>
                <TextContent>
                  <h5>{dataVaultDetailLabels.ulidLabel}</h5>
                  <span>
                    <Box margin={{ right: 'xxs' }} display="inline-block">
                      <Popover
                        size="small"
                        position="top"
                        triggerType="custom"
                        dismissButton={false}
                        content={
                          <StatusIndicator type="success">
                            {dataVaultDetailLabels.ulidLabel} copied
                          </StatusIndicator>
                        }
                      >
                        <Button
                          variant="inline-icon"
                          iconName="copy"
                          ariaLabel={dataVaultDetailLabels.copyDataVaultUlidAriaLabel}
                          onClick={() => navigator.clipboard.writeText(data.ulid)}
                        />
                      </Popover>
                    </Box>
                    {data.ulid}
                  </span>
                </TextContent>
              </SpaceBetween>
              <TextContent>
                <div>
                  <h5>{commonLabels.description}</h5>
                  <p>{data.description ?? '-'}</p>
                </div>
              </TextContent>
              <SpaceBetween size="m">
                <TextContent>
                  <h5>{dataVaultDetailLabels.objectCounterLabel}</h5>
                  <p>{data.objectCount ?? '-'}</p>
                </TextContent>
                <TextContent>
                  <h5>{dataVaultDetailLabels.totalSizeLabel}</h5>
                  <p>{formatFileSize(data.totalSizeBytes)}</p>
                </TextContent>
              </SpaceBetween>
            </ColumnLayout>
          </Container>
          <DataVaultFilesTable dataVaultId={props.dataVaultId}></DataVaultFilesTable>
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

export default DataVaultDetailsBody;
