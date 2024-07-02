/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Flashbar } from '@cloudscape-design/components';
import { commonLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { i18nStringsForFlashbar } from './commonDefinitions';

export function Notifications() {
  const { notifications, dismissNotification } = useNotifications();
  return (
    <Flashbar
      i18nStrings={i18nStringsForFlashbar}
      items={notifications.map((notification) => ({
        type: notification.type,
        dismissible: true,
        dismissLabel: commonLabels.dismissMessageLabel,
        content: notification.content,
        id: notification.id,
        ariaRole: notification.type === 'error' ? 'alert' : 'status',
        onDismiss: () => dismissNotification(notification.id),
        statusIconAriaLabel: notification.type === 'error' ? 'Error' : 'Success',
      }))}
      stackItems
    />
  );
}
