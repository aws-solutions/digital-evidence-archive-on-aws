/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, Header, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import { useGetDataVaultById } from '../../api/data-vaults';
import { commonLabels, createDataVaultLabels } from '../../common/labels';
import EditDataVaultForm from './EditDataVaultForm';

export interface EditDataVaultPageProps {
  readonly dataVaultId: string;
}

function EditDataVaultPage(props: EditDataVaultPageProps) {
  const { data, isLoading } = useGetDataVaultById(props.dataVaultId);
  console.log('EditDataVaultPage', data);
  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
  }
  if (!data) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }
  return (
    <ContentLayout
      data-testid="edit-data-vault-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1" description={createDataVaultLabels.createNewDataVaultDescription}>
            {data.name}
          </Header>
        </SpaceBetween>
      }
    >
      <EditDataVaultForm dataVault={data}></EditDataVaultForm>
    </ContentLayout>
  );
}

export default EditDataVaultPage;
