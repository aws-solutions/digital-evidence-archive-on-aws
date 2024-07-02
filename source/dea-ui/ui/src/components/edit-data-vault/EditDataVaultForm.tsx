/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
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
import { updateDataVault } from '../../api/data-vaults';
import { commonLabels, createDataVaultLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';

export interface EditDataVaultFormProps {
  readonly dataVault: DeaDataVault;
}

function EditDataVaultForm(props: EditDataVaultFormProps): JSX.Element {
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<DeaDataVault>(props.dataVault);
  const { pushNotification } = useNotifications();
  const dataVaultDetailsRoute = `/data-vault-detail?dataVaultId=${props.dataVault.ulid}`;
  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      await updateDataVault(formData);
      pushNotification('success', createDataVaultLabels.successNotificationMessageOnUpdate);
      return router.push(dataVaultDetailsRoute);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
    }
  }

  function onCancelHandler() {
    return router.push(dataVaultDetailsRoute);
  }

  return (
    <SpaceBetween data-testid="edit-data-vault-form-space" size="s">
      <Form
        data-testid="edit-data-vault-form"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              formAction="none"
              variant="link"
              data-testid="edit-data-vault-cancel"
              onClick={onCancelHandler}
            >
              {commonLabels.cancelButton}
            </Button>
            <Button
              variant="primary"
              iconAlign="right"
              data-testid="edit-data-vault-submit"
              onClick={onSubmitHandler}
              disabled={IsSubmitLoading || !formData.name}
            >
              {commonLabels.saveButton}
            </Button>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">{createDataVaultLabels.enterDetailsLabelOnUpdate}</Header>}>
          <SpaceBetween direction="vertical" size="l">
            <FormField
              data-testid="input-name"
              label={createDataVaultLabels.nameLabel}
              description={createDataVaultLabels.nameDescription}
            >
              <Input
                value={formData?.name}
                onChange={({ detail: { value } }) => {
                  setFormData({ ...formData, name: value });
                }}
              />
              <TextContent>
                <p>
                  <small>{createDataVaultLabels.nameSubtext}</small>
                </p>
              </TextContent>
            </FormField>
            <FormField
              data-testid="input-description"
              label={
                <span>
                  {createDataVaultLabels.descriptionLabel} <i> {commonLabels.optionalLabel}</i>{' '}
                </span>
              }
              description={createDataVaultLabels.descriptionDescription}
            >
              <Textarea
                value={formData?.description ?? ''}
                onChange={({ detail: { value } }) => {
                  setFormData({ ...formData, description: value.trim().length === 0 ? undefined : value });
                }}
              />
              <TextContent>
                <p>
                  <small>{createDataVaultLabels.descriptionSubtext}</small>
                </p>
              </TextContent>
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </SpaceBetween>
  );
}

export default EditDataVaultForm;
