/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FlashbarProps } from '@cloudscape-design/components';
import { Context, createContext, useContext, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { IAppNotification } from '../models/AppNotification';

export interface INotificationsProps {
  notifications: IAppNotification[];
  pushNotification: (type: FlashbarProps.Type, content: string) => void;
  dismissNotification: (id: string) => void;
}

const defaultAppNotification: INotificationsProps = {
  notifications: [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pushNotification: (type: FlashbarProps.Type, content: string) => {
    /*do nothing*/
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dismissNotification: (id: string) => {
    /*do nothing*/
  },
};

const NotificationsContext: Context<INotificationsProps> =
  createContext<INotificationsProps>(defaultAppNotification);

export function NotificationsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [notifications, setNotifications] = useState<IAppNotification[]>([]);

  function pushNotification(type: FlashbarProps.Type, content: string): void {
    setNotifications([...notifications, { id: uuidv4(), type, content }]);
  }
  function dismissNotification(id: string): void {
    setNotifications((notifications) => notifications.filter((notifications) => notifications.id !== id));
  }
  return (
    <NotificationsContext.Provider value={{ notifications, pushNotification, dismissNotification }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): INotificationsProps {
  return useContext(NotificationsContext);
}
