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
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateCase } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { commonLabels, createCaseLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { EditCaseForm } from '../../models/Cases';

export interface EditCasesFormProps {
  readonly case: DeaCaseDTO;
}

function EditCasesForm(props: EditCasesFormProps): JSX.Element {
  const { ulid, name, description } = props.case;
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<EditCaseForm>({ ulid, name, description });
  const { pushNotification } = useNotifications();
  const caseDetailsRoute = `/case-detail?caseId=${ulid}`;
  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      await updateCase(formData);
      return router.push(caseDetailsRoute);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
    }
  }

  function onCancelHandler() {
    return router.push(caseDetailsRoute);
  }

  return (
    <SpaceBetween data-testid="edit-case-form-space" size="s">
      <Form
        data-testid="edit-case-form"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" data-testid="edit-case-cancel" onClick={onCancelHandler}>
              {commonLabels.cancelButton}
            </Button>
            <Button
              variant="primary"
              iconAlign="right"
              data-testid="edit-case-submit"
              onClick={onSubmitHandler}
              disabled={IsSubmitLoading || !formData.name}
            >
              {commonLabels.saveButton}
            </Button>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">{createCaseLabels.enterCaseDetailsLabel}</Header>}>
          <SpaceBetween direction="vertical" size="l">
            <FormField
              data-testid="input-name"
              label={createCaseLabels.caseNameLabel}
              description={createCaseLabels.caseNameDescription}
            >
              <Input
                value={formData?.name}
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
              label={
                <span>
                  {createCaseLabels.caseDescription} <i> {commonLabels.optionalLabel}</i>{' '}
                </span>
              }
              description={createCaseLabels.caseDescriptionSubtext}
            >
              <Textarea
                value={formData?.description ?? ''}
                onChange={({ detail: { value } }) => {
                  setFormData({ ...formData, description: value.trim().length === 0 ? undefined : value });
                }}
              />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </SpaceBetween>
  );
}

export default EditCasesForm;
