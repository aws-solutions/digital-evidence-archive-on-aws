/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import * as React from 'react';
import { createCaseLabels } from '../../common/labels';
import CreateCasesForm from './CreateCasesForm';

function CreateCasePage() {
  return (
    <ContentLayout
      data-testid="create-case-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1" description={createCaseLabels.createNewCaseDescription}>
            {createCaseLabels.createNewCaseLabel}
          </Header>
        </SpaceBetween>
      }
    >
      <CreateCasesForm></CreateCasesForm>
    </ContentLayout>
  );
}

export default CreateCasePage;
