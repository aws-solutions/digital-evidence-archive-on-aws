/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVaultInput } from '@aws/dea-app/lib/models/data-vault';
import {
  Button,
  Container,
  Form,
  FormField,
  Header,
  Input,
  Link,
  SpaceBetween,
  Textarea,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { createDataVault } from '../../api/data-vaults';
import {
  accessiblityLabels,
  commonLabels,
  commonTableLabels,
  createDataVaultLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';

function CreateDataVaultsForm(): JSX.Element {
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState<DeaDataVaultInput>({ name: '' });
  const { pushNotification } = useNotifications();

  async function onSubmitHandler() {
    setIsSubmitLoading(true);
    try {
      const newDataVault = await createDataVault(formData);
      pushNotification(
        'success',
        <>
          {createDataVaultLabels.successNotificationMessage}{' '}
          <Link
            external
            color="inverted"
            externalIconAriaLabel={accessiblityLabels.implementationGuideLinkLabel}
            ariaLabel={accessiblityLabels.implementationGuideLinkLabel}
            href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
          >
            {commonTableLabels.implementationGuideLabel}
          </Link>
        </>
      );
      return router.push(`/data-vault-detail?dataVaultId=${newDataVault.ulid}`);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
    }
  }

  function onCancelHandler() {
    return router.push('/data-vaults');
  }

  return (
    <SpaceBetween data-testid="create-data-vault-form-space" size="s">
      <Form
        data-testid="create-data-vault-form"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              iconAlign="right"
              formAction="none"
              variant="link"
              data-testid="create-data-vault-cancel"
              onClick={onCancelHandler}
            >
              {commonLabels.cancelButton}
            </Button>
            <Button
              variant="primary"
              iconAlign="right"
              data-testid="create-data-vault-submit"
              onClick={onSubmitHandler}
              disabled={IsSubmitLoading || !formData.name}
            >
              {commonLabels.createButton}
            </Button>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">{createDataVaultLabels.enterDetailsLabel}</Header>}>
          <SpaceBetween direction="vertical" size="l">
            <FormField
              data-testid="input-name"
              label={createDataVaultLabels.nameLabel}
              description={createDataVaultLabels.nameDescription}
            >
              <Input
                value={formData?.name || ''}
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

export default CreateDataVaultsForm;
