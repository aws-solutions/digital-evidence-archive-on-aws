/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header, Container, ColumnLayout } from '@cloudscape-design/components';
import { useGetCaseById } from '../../api/cases';
import { commonLabels } from '../../common/labels';
import CaseDetailsTabs from './CaseDetailsTabs';

export interface CaseDetailsBodyProps {
  readonly caseId: string;
}

function CaseDetailsBody(props: CaseDetailsBodyProps): JSX.Element {
  const { data, isLoading } = useGetCaseById(props.caseId);
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
        <Container header={<Header variant="h2">Case Details</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              {' '}
              <h4>Creation Date</h4>
              <p>{new Date(data.created).toLocaleString()}</p>
              <h4>Case Lead(s)</h4>
              <p>Sherlock Holmes</p>
            </div>
            <div>
              <h4>Description</h4>
              <p>{data.description}</p>
            </div>
            <div>
              {' '}
              <h4>Status</h4>
            </div>
          </ColumnLayout>
        </Container>
        <CaseDetailsTabs caseId={props.caseId}></CaseDetailsTabs>
      </ContentLayout>
    );
  }
}

export default CaseDetailsBody;
