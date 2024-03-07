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
import { useRouter } from 'next/navigation';
import { useAvailableEndpoints } from '../../api/auth';
import { getDataVaultAuditCSV, useGetDataVaultById } from '../../api/data-vaults';
import { auditLogLabels, commonLabels, dataVaultDetailLabels } from '../../common/labels';
import { formatDateTimeFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import { AuditDownloadButton } from '../audit/audit-download-button';
import ActionContainer from '../common-components/ActionContainer';
import DataVaultFilesTable from './DataVaultFilesTable';

export const DATA_VAULTS_PUT_ENDPOINT = '/datavaults/{dataVaultId}/detailsPUT';
export const DATA_VAULTS_AUDIT_ENDPOINT = '/datavaults/{dataVaultId}/auditPOST';
export const DOWNLOAD_AUDIT_TEST_ID = 'download-datavault-audit-csv-button';
export interface DataVaultDetailsBodyProps {
  readonly dataVaultId: string;
  readonly setdataVaultName: (name: string) => void;
}

function DataVaultDetailsBody(props: DataVaultDetailsBodyProps): JSX.Element {
  const { setdataVaultName } = props;
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data, isLoading } = useGetDataVaultById(props.dataVaultId);
  let dataVaultName: string;

  function editHandler() {
    return router.push(`/edit-data-vault?dataVaultId=${props.dataVaultId}&dataVaultName=${dataVaultName}`);
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

    setdataVaultName(data.name);
    dataVaultName = data.name;

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
                    <ActionContainer required={DATA_VAULTS_AUDIT_ENDPOINT} actions={availableEndpoints.data}>
                      <AuditDownloadButton
                        label={auditLogLabels.dataVaultAuditLogLabel}
                        testId={DOWNLOAD_AUDIT_TEST_ID}
                        permissionCallback={() =>
                          availableEndpoints.data?.includes(DATA_VAULTS_AUDIT_ENDPOINT)
                        }
                        downloadCallback={async () => await getDataVaultAuditCSV(data.ulid)}
                        type="DataVault"
                        targetName={data.name}
                      />
                    </ActionContainer>
                    <ActionContainer required={DATA_VAULTS_PUT_ENDPOINT} actions={availableEndpoints.data}>
                      <Button
                        disabled={!availableEndpoints.data?.includes(DATA_VAULTS_PUT_ENDPOINT)}
                        onClick={editHandler}
                      >
                        {commonLabels.editButton}
                      </Button>
                    </ActionContainer>
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
                  <span>
                    <strong>{commonLabels.creationDate}</strong>
                  </span>
                  <p>{formatDateTimeFromISOString(data.created?.toString())}</p>
                </TextContent>
                <TextContent>
                  <span>
                    <strong>{dataVaultDetailLabels.ulidLabel}</strong>
                  </span>
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
                    <p>{data.ulid}</p>
                  </span>
                </TextContent>
              </SpaceBetween>
              <TextContent>
                <div>
                  <span>
                    <strong>{commonLabels.description}</strong>
                  </span>
                  <p>{data.description ?? '-'}</p>
                </div>
              </TextContent>
              <SpaceBetween size="l">
                <TextContent>
                  <span>
                    <strong>{dataVaultDetailLabels.objectCounterLabel}</strong>
                  </span>
                  <p>{data.objectCount ?? '-'}</p>
                </TextContent>
                <TextContent>
                  <span>
                    <strong>{dataVaultDetailLabels.totalSizeLabel}</strong>
                  </span>
                  <p>{formatFileSize(data.totalSizeBytes)}</p>
                </TextContent>
              </SpaceBetween>
            </ColumnLayout>
          </Container>
          <DataVaultFilesTable
            dataVaultId={props.dataVaultId}
            availableEndpoints={availableEndpoints.data}
            dataVaultName={data.name}
          ></DataVaultFilesTable>
        </SpaceBetween>
      </ContentLayout>
    );
  }
}

export default DataVaultDetailsBody;
