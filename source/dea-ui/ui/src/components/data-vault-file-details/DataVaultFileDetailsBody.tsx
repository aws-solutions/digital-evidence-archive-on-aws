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
  Modal,
  SpaceBetween,
  TextContent,
} from '@cloudscape-design/components';
import { useState } from 'react';
import { useGetDataVaultFileDetailsById } from '../../api/data-vaults';
import {
  auditLogLabels,
  breadcrumbLabels,
  commonLabels,
  commonTableLabels,
  dataVaultDetailLabels,
  fileDetailLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';

export interface DataVaultFileDetailsBodyProps {
  readonly dataVaultId: string;
  readonly fileId: string;
}

function DataVaultFileDetailsBody(props: DataVaultFileDetailsBodyProps): JSX.Element {
  const { data, isLoading } = useGetDataVaultFileDetailsById(props.dataVaultId, props.fileId);
  const [showDisassociateToCaseModal, setShowDisassociateToCaseModal] = useState(false);
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const { pushNotification } = useNotifications();

  function enableDisassociateToCaseModal() {
    setShowDisassociateToCaseModal(true);
  }

  function disableDisassociateToCaseModal() {
    setShowDisassociateToCaseModal(false);
  }

  async function disassociateToCaseHandler() {
    setIsSubmitLoading(true);
    try {
      // TODO: endpoint call.
      await Promise.resolve();
      pushNotification('success', dataVaultDetailLabels.disassociateFromCaseSuccessNotificationMessage);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
      disableDisassociateToCaseModal();
    }
  }

  function disassociateModal() {
    return (
      <Modal
        data-testid="disassociate-to-case-modal"
        onDismiss={disableDisassociateToCaseModal}
        visible={showDisassociateToCaseModal}
        closeAriaLabel={commonLabels.closeModalAriaLabel}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={disableDisassociateToCaseModal}>
                {commonLabels.cancelButton}
              </Button>
              <Button
                data-testid="submit-case-disassociation"
                variant="primary"
                onClick={disassociateToCaseHandler}
                disabled={IsSubmitLoading}
              >
                {commonLabels.disassociateButton}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <TextContent>
            <h2>{`${dataVaultDetailLabels.disassociateFromCaseModalTitle} ${data?.fileName}`}</h2>
          </TextContent>
        }
      >
        <Box padding={{ bottom: 'xxl' }}>
          <TextContent>
            <h5>{dataVaultDetailLabels.disassociateFromCaseModalSectionHeader}</h5>
          </TextContent>
        </Box>
      </Modal>
    );
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
                    {disassociateModal()}
                    <Button
                      data-testid="disassociate-data-vault-file-button"
                      onClick={enableDisassociateToCaseModal}
                    >
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
