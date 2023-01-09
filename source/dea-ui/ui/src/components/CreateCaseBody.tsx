import * as React from 'react';
import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import CreateCaseForm from './CreateCaseForm';

function CreateCasePage() {
  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header variant="h1">Create New Case</Header>
        </SpaceBetween>
      }
    >
      <CreateCaseForm></CreateCaseForm>
    </ContentLayout>
  );
}

export default CreateCasePage;
