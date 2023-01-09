/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header } from '@cloudscape-design/components';
import { useRouter } from 'next/router';

function CaseDetailsBody(props: { caseId: string }): JSX.Element {
  const router = useRouter();
  console.log('inside case body');
  console.log(props.caseId);
  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header variant="h1">CASE#PLACEHOLDER</Header>
        </SpaceBetween>
      }
    ></ContentLayout>
  );
}

export default CaseDetailsBody;
