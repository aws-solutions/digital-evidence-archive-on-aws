/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Flashbar } from '@cloudscape-design/components';
import { commonLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';

export function Notifications() {
  const { notifications, dismissNotification } = useNotifications();
  return (
    <Flashbar
      items={notifications.map((notification) => ({
        type: notification.type,
        dismissible: true,
        dismissLabel: commonLabels.dismissMessageLabel,
        content: notification.content,
        id: notification.id,
        onDismiss: () => dismissNotification(notification.id),
      }))}
    />
  );
}
