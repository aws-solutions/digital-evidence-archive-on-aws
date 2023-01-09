/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header, Container } from '@cloudscape-design/components';

function CaseDetailsBody(props: any): JSX.Element {
  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header variant="h1">{props.caseName}</Header>
        </SpaceBetween>
      }
    >
      <Container header={<Header variant="h2">Case Details</Header>}>
        <h4>Description</h4>
        <p>{props.description}</p>
        <h4>Creation Date</h4>
        <p>MON 0/00/0000</p>
        <h4>Case Lead(s)</h4>
        <p>Sherlock Holmes</p>
        <h4>Status</h4>
        <p>{props.status}</p>
      </Container>
    </ContentLayout>
  );
}

export default CaseDetailsBody;
