/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import React from 'react';
import { commonLabels } from '../../common/labels';

interface InputModalProps {
  modalTestId: string;
  inputTestId: string;
  cancelButtonTestId: string;
  primaryButtonTestId: string;
  isOpen: boolean;
  title: string;
  inputHeader: string;
  inputDetails: string;
  inputField: string;
  setInputField: React.Dispatch<React.SetStateAction<string>>;
  confirmAction: () => void;
  confirmButtonText: string;
  cancelAction: () => void;
  cancelButtonText?: string;
}

export function FormFieldModal(props: InputModalProps) {
  const {
    modalTestId,
    inputTestId,
    cancelButtonTestId,
    primaryButtonTestId,
    isOpen,
    title,
    inputHeader,
    inputDetails,
    inputField,
    setInputField,
    confirmAction,
    confirmButtonText,
    cancelAction,
    cancelButtonText,
  } = props;

  return (
    <Modal
      data-testid={modalTestId}
      onDismiss={cancelAction}
      visible={isOpen}
      closeAriaLabel={commonLabels.closeModalAriaLabel}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button data-testid={cancelButtonTestId} variant="link" onClick={cancelAction}>
              {cancelButtonText ?? commonLabels.cancelButton}
            </Button>
            <Button data-testid={primaryButtonTestId} variant="primary" onClick={confirmAction}>
              {confirmButtonText}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={title}
    >
      <FormField description={inputDetails} label={inputHeader}>
        <Input
          data-testid={inputTestId}
          value={inputField}
          onChange={(event) => setInputField(event.detail.value)}
        />
      </FormField>
    </Modal>
  );
}
