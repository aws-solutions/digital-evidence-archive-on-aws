/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header, Button, Container } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import CaseTable from './CaseTable';

function CaseListBody(): JSX.Element {
  const router = useRouter();

  function createNewCaseHandler() {
    router.push('/create-cases');
  }

  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            description="This is a list of cases that have been shared with you."
            actions={
              <Button variant="primary" onClick={createNewCaseHandler}>
                Create new case
              </Button>
            }
          >
            Cases
          </Header>
        </SpaceBetween>
      }
    >
      <CaseTable></CaseTable>
    </ContentLayout>
  );
}

export default CaseListBody;
