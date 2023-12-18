/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ContentLayout, Header, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import { useGetCaseById } from '../../api/cases';
import { commonLabels, createCaseLabels } from '../../common/labels';
import EditCasesForm from './EditCasesForm';

export interface EditCasePageProps {
  readonly caseId: string;
}

function EditCasePage(props: EditCasePageProps) {
  const { data, isLoading } = useGetCaseById(props.caseId);

  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
  }
  if (!data) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }
  return (
    <ContentLayout
      data-testid="edit-case-page"
      header={
        <SpaceBetween size="m">
          <Header variant="h1" description={createCaseLabels.createNewCaseDescription}>
            {data.name}
          </Header>
        </SpaceBetween>
      }
    >
      <EditCasesForm case={data}></EditCasesForm>
    </ContentLayout>
  );
}

export default EditCasePage;
