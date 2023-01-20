/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  ContentLayout,
  SpaceBetween,
  Header,
  Container,
  ColumnLayout,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useGetCaseById } from '../../api/cases';
import { commonLabels } from '../../common/labels';
import CaseDetailsTabs from './CaseDetailsTabs';

function CaseDetailsBody(props: any): JSX.Element {
  const { caseDetail, areCasesLoading } = useGetCaseById(props.caseId);
  if (areCasesLoading) {
    return <h1>{commonLabels.loadingLabel}</h1>;
  } else {
    if (!caseDetail) return <></>;
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <Header variant="h1">{caseDetail.name}</Header>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">Case Details</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              {' '}
              <h4>Creation Date</h4>
              <p>MON 0/00/0000</p>
              <h4>Case Lead(s)</h4>
              <p>Sherlock Holmes</p>
            </div>
            <div>
              <h4>Description</h4>
              <p>{caseDetail.description}</p>
            </div>
            <div>
              {' '}
              <h4>Status</h4>
              <p>
                <StatusIndicator type={caseDetail.status === 'ACTIVE' ? 'success' : 'error'}>
                  {caseDetail.status}
                </StatusIndicator>
              </p>
            </div>
          </ColumnLayout>
        </Container>
        <CaseDetailsTabs></CaseDetailsTabs>
      </ContentLayout>
    );
  }
}

export default CaseDetailsBody;
