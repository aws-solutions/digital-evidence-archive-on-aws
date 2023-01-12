import * as React from 'react';
import { Container, FormField, Header, Input } from '@cloudscape-design/components';

function ManageAccessForm() {
  const [inputValue, setInputValue] = React.useState('');
  return (
    <Container header={<Header variant="h2">Manage Case Access</Header>}>
      <FormField
        description="Members added or remvoed will be notified by email. Their access to case details will be based on permissions set"
        label="Search for people to invite"
      >
        <Input value={inputValue} onChange={(event) => setInputValue(event.detail.value)} />
      </FormField>
    </Container>
  );
}

export default ManageAccessForm;
