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
  Textarea,
  RadioGroup,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import { createCase } from '../../api/cases';
import { commonLabels, createCaseLabels } from '../../common/labels';
import { CreateCaseForm } from '../../models/Cases';
import CreateCaseShareCaseForm from './CreateCaseShareCaseForm';

function CreateCasesForm(): JSX.Element {
  const [caseStatusValue, setCaseStatusValue] = React.useState('active');
  const [, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<CreateCaseForm>({ name: '' });

  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      await createCase(formData);
    } finally {
      setIsSubmitLoading(false);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      router.push('/');
    }
  }

  function onCancelHandler() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push('/');
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
              <TextContent>
                <p>
                  <strong>{createCaseLabels.caseStatusLabel}</strong>
                </p>
              </TextContent>
              <RadioGroup
                onChange={({ detail }) => setCaseStatusValue(detail.value)}
                value={caseStatusValue}
                items={[
                  {
                    value: 'active',
                    label: `${createCaseLabels.activeLabel}`,
                    description: `${createCaseLabels.activeCaseDescription}`,
                  },
                  {
                    value: 'archive',
                    label: `${createCaseLabels.archivedLabel}`,
                    description: `${createCaseLabels.archivedCaseDescription}`,
                  },
                ]}
              />
            </SpaceBetween>
          </Container>
        </Form>
      </form>
      <CreateCaseShareCaseForm></CreateCaseShareCaseForm>
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
