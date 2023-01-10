/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header, Container } from '@cloudscape-design/components';
import { useState, useEffect } from 'react';
import { useGetCaseById } from '../api/cases';

function CaseDetailsBody(props: any): JSX.Element {
  const { caseDetail, areCasesLoading } = useGetCaseById(props.caseId);
  if (areCasesLoading) {
    return <h1>Loading...</h1>;
  } else {
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <Header variant="h1">{caseDetail.name}</Header>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">Case Details</Header>}>
          <h4>Description</h4>
          <p>{caseDetail.description}</p>
          <h4>Creation Date</h4>
          <p>MON 0/00/0000</p>
          <h4>Case Lead(s)</h4>
          <p>Sherlock Holmes</p>
          <h4>Status</h4>
          <p>{caseDetail.status}</p>
        </Container>
      </ContentLayout>
    );
  }
}

export default CaseDetailsBody;
