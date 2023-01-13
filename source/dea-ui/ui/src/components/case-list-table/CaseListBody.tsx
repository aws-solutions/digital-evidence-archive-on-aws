/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, SpaceBetween, Header, Button } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { caseListLabels } from '../../common/labels';
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
              <SpaceBetween direction="horizontal" size="xs">
                <Button>{caseListLabels.archiveButton}</Button>
                <Button>{caseListLabels.activateButton}</Button>
                <Button variant="primary" onClick={createNewCaseHandler}>
                  {caseListLabels.createNewCaseLabel}
                </Button>{' '}
              </SpaceBetween>
            }
          >
            {caseListLabels.casesLabel}
          </Header>
        </SpaceBetween>
      }
    >
      <CaseTable></CaseTable>
    </ContentLayout>
  );
}

export default CaseListBody;
