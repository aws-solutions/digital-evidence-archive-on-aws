/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FlashbarProps } from '@cloudscape-design/components';
import { Context, createContext, useContext, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { IAppNotification } from '../models/AppNotification';

export interface INotificationsProps {
  notifications: IAppNotification[];
  pushNotification: (type: FlashbarProps.Type, content: React.ReactNode) => void;
  dismissNotification: (id: string) => void;
}

const defaultAppNotification: INotificationsProps = {
  notifications: [],
  pushNotification: (_type: FlashbarProps.Type, _content: React.ReactNode) => {
    /*do nothing*/
  },
  dismissNotification: (_id: string) => {
    /*do nothing*/
  },
};

const NotificationsContext: Context<INotificationsProps> =
  createContext<INotificationsProps>(defaultAppNotification);

export function NotificationsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [notifications, setNotifications] = useState<IAppNotification[]>([]);

  function pushNotification(type: FlashbarProps.Type, content: React.ReactNode): void {
    setNotifications([...notifications, { id: uuidv4(), type, content }]);
  }

  function dismissNotification(id: string): void {
    setNotifications((notifications) => notifications.filter((notifications) => notifications.id !== id));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const props = useMemo(() => ({ notifications, pushNotification, dismissNotification }), [notifications]);
  return <NotificationsContext.Provider value={props}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): INotificationsProps {
  return useContext(NotificationsContext);
}
