/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { commonLabels } from '../../common/labels';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmAction: () => void;
  confirmButtonText: string;
  cancelAction: () => void;
  cancelButtonText?: string;
}

export function ConfirmModal(props: ConfirmModalProps) {
  const { isOpen, title, message, cancelAction, cancelButtonText, confirmAction, confirmButtonText } = props;
  return (
    <Modal
      onDismiss={cancelAction}
      visible={isOpen}
      closeAriaLabel={commonLabels.closeModalAriaLabel}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={cancelAction}>
              {cancelButtonText ?? commonLabels.cancelButton}
            </Button>
            <Button variant="primary" onClick={confirmAction}>
              {confirmButtonText}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={title}
    >
      {message}
    </Modal>
  );
}
