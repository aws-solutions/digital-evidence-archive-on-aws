/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FlashbarProps } from '@cloudscape-design/components/flashbar';
import { createContext, useContext, Context, useState } from 'react';

export interface INotifications {
  [key: string]: FlashbarProps.MessageDefinition;
}

export interface INotificationProps {
  notifications: INotifications;
  displayNotification: (id: string, notification: FlashbarProps.MessageDefinition) => void;
}

const NotificationsContext: Context<INotificationProps> = createContext({
  notifications: {},
  displayNotification: (id: string, notification: FlashbarProps.MessageDefinition) => {
    console.log(`${id}, ${notification}`);
  },
});

export function NotificationsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [notifications, setNotifications] = useState<INotifications>({});
  const displayNotification = (id: string, notification: FlashbarProps.MessageDefinition): void => {
    if (id in notifications) {
      return;
    }
    const others = { ...notifications };
    // eslint-disable-next-line security/detect-object-injection
    others[id] = notification;
    setNotifications(others);
  };
  return (
    <NotificationsContext.Provider value={{ notifications, displayNotification }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): INotificationProps {
  return useContext(NotificationsContext);
}
