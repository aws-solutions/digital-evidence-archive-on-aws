/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Form,
  SpaceBetween,
  Button,
  Header,
  Container,
  Input,
  FormField,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import { createCase } from '../api/cases';
import { CreateCaseForm } from '../models/Cases';

function CreateCasesForm(): JSX.Element {
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<CreateCaseForm>({ name: '' });

  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      await createCase(formData);
    } finally {
      setIsSubmitLoading(false);
      router.push('/');
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link">
              Cancel
            </Button>
            <Button variant="primary" onClick={onSubmitHandler} loading={isSubmitLoading}>
              Submit
            </Button>
          </SpaceBetween>
        }
        header={<Header variant="h1">Create new case</Header>}
      >
        <Container header={<Header variant="h2">Enter Case Details</Header>}>
          <SpaceBetween direction="vertical" size="l">
            <FormField label="Case name">
              <Input
                value={formData?.name || ''}
                onChange={({ detail: { value } }) => {
                  setFormData({ ...formData, name: value });
                }}
              />
            </FormField>
            <FormField label="Description - optional">
              <Input
                value={formData?.description || ''}
                onChange={({ detail: { value } }) => {
                  setFormData({ ...formData, description: value });
                }}
              />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
}

export default CreateCasesForm;