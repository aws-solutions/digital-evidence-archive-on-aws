/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Container, Header, ColumnLayout, TextContent, SpaceBetween } from '@cloudscape-design/components';
import { fileDetailLabels, commonTableLabels, dataVaultDetailLabels } from '../../common/labels';

export interface dataVaultAssociationDetailsProps {
  readonly dataVaultUlid: string;
  readonly dataVaultName: string;
  readonly executionId: string;
  readonly associationCreatedBy: string;
  readonly associationDate: Date | undefined;
}

function DataVaultAssociationDetailsBody(props: dataVaultAssociationDetailsProps): JSX.Element {
  return (
    <Container header={<Header variant="h2">{dataVaultDetailLabels.dataVaultDetailsLabel}</Header>}>
      <ColumnLayout columns={2} variant="text-grid">
        <TextContent>
          <SpaceBetween size="l">
            <div>
              <span>
                <strong>{fileDetailLabels.dataVaultLabel}</strong>
              </span>
              <p>{props.dataVaultName}</p>
            </div>
            <div>
              <span>
                <strong>{commonTableLabels.executionIdHeader}</strong>
              </span>
              <p>{props.executionId}</p>
            </div>
          </SpaceBetween>
        </TextContent>
        <TextContent>
          <SpaceBetween size="l">
            <div>
              <span>
                <strong>{fileDetailLabels.associatedBy}</strong>
              </span>
              <p>{props.associationCreatedBy}</p>
            </div>
            <div>
              <span>
                <strong>{fileDetailLabels.associationDateLabel}</strong>
              </span>
              <p>
                {props.associationDate
                  ? new Date(props.associationDate).toLocaleString([], {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '-'}
              </p>
            </div>
          </SpaceBetween>
        </TextContent>
      </ColumnLayout>
    </Container>
  );
}

export default DataVaultAssociationDetailsBody;
