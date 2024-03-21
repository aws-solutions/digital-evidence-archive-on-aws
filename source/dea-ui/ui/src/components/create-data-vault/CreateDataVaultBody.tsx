/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import * as React from 'react';
import { createDataVaultLabels } from '../../common/labels';
import CreateDataVaultsForm from './CreateDataVaultsForm';

function CreateDataVaultPage() {
  return (
    <ContentLayout
      data-testid="create-data-vault-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1" description={createDataVaultLabels.createNewDataVaultDescription}>
            {createDataVaultLabels.createNewDataVaultLabel}
          </Header>
        </SpaceBetween>
      }
    >
      <CreateDataVaultsForm></CreateDataVaultsForm>
    </ContentLayout>
  );
}

export default CreateDataVaultPage;
