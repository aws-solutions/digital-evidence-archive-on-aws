import * as React from 'react';
import {
  Form,
  SpaceBetween,
  Button,
  Header,
  Container,
  Input,
  FormField,
} from '@cloudscape-design/components';

function CreateCaseForm(): JSX.Element {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link">
              Cancel
            </Button>
            <Button variant="primary">Submit</Button>
          </SpaceBetween>
        }
        header={<Header variant="h1">Create new case</Header>}
      >
        <Container header={<Header variant="h2">Enter Case Details</Header>}>
          <SpaceBetween direction="vertical" size="l">
            <FormField label="Case name">
              <Input />
            </FormField>
            <FormField label="Description - optional">
              <Input />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
}

export default CreateCaseForm;
