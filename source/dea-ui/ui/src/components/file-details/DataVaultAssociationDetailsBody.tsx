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
              <h5>{fileDetailLabels.dataVaultLabel}</h5>
              <p>{props.dataVaultName}</p>
            </div>
            <div>
              <h5>{commonTableLabels.executionIdHeader}</h5>
              <p>{props.executionId}</p>
            </div>
          </SpaceBetween>
        </TextContent>
        <TextContent>
          <SpaceBetween size="l">
            <div>
              <h5>{fileDetailLabels.associatedBy}</h5>
              {props.associationCreatedBy}
            </div>
            <div>
              <h5>{fileDetailLabels.associationDateLabel}</h5>
              {props.associationDate
                ? new Date(props.associationDate).toLocaleString([], {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '-'}
            </div>
          </SpaceBetween>
        </TextContent>
      </ColumnLayout>
    </Container>
  );
}

export default DataVaultAssociationDetailsBody;
