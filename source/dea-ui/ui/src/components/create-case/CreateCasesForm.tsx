/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Button,
  Container,
  Form,
  FormField,
  Header,
  Input,
  SpaceBetween,
  Textarea,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import { createCase } from '../../api/cases';
import { commonLabels, createCaseLabels } from '../../common/labels';
import { CreateCaseForm } from '../../models/Cases';

function CreateCasesForm(): JSX.Element {
  const [, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<CreateCaseForm>({ name: '' });

  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      await createCase(formData);
    } finally {
      setIsSubmitLoading(false);
      void router.push('/');
    }
  }

  function onCancelHandler() {
    void router.push('/');
  }

  return (
    <SpaceBetween data-testid="create-case-form-space" size="s">
      <form onSubmit={(e) => e.preventDefault()} data-testid="create-case-form">
        <Form>
          <Container header={<Header variant="h2">{createCaseLabels.enterCaseDetailsLabel}</Header>}>
            <SpaceBetween direction="vertical" size="l">
              <FormField
                data-testid="input-name"
                label={createCaseLabels.caseNameLabel}
                description={createCaseLabels.caseNameDescription}
              >
                <Input
                  value={formData?.name || ''}
                  onChange={({ detail: { value } }) => {
                    setFormData({ ...formData, name: value });
                  }}
                />
                <TextContent>
                  <p>
                    <small>{createCaseLabels.caseNameSubtext}</small>
                  </p>
                </TextContent>
              </FormField>
              <FormField
                data-testid="input-description"
                label={createCaseLabels.caseDescription}
                description={createCaseLabels.caseDescriptionSubtext}
              >
                <Textarea
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
      <SpaceBetween direction="horizontal" size="xs">
        <Button formAction="none" variant="link" data-testid="create-case-cancel" onClick={onCancelHandler}>
          {commonLabels.cancelButton}
        </Button>
        <Button
          variant="primary"
          iconAlign="right"
          data-testid="create-case-submit"
          onClick={onSubmitHandler}
        >
          {commonLabels.createButton}
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );
}

export default CreateCasesForm;
