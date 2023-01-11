import { SpaceBetween, ContentLayout, Header } from '@cloudscape-design/components';
import * as React from 'react';
import CreateCasesForm from './CreateCasesForm';

function CreateCasePage() {
  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header variant="h1">Create New Case</Header>
        </SpaceBetween>
      }
    >
      <CreateCasesForm></CreateCasesForm>
    </ContentLayout>
  );
}

export default CreateCasePage;
