/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Flashbar from '@cloudscape-design/components/flashbar';
import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import styles from '../styles/BaseLayout.module.scss';

export default function Layout({ children }: { children: React.ReactNode }): JSX.Element {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { notifications } = useNotifications();

  const appLayoutLabels: AppLayoutProps.Labels = {
    navigation: 'Navigation drawer',
    navigationClose: 'Close navigation drawer',
    navigationToggle: 'Open navigation drawer',
    notifications: 'Notifications',
    tools: 'Help panel',
    toolsClose: 'Close help panel',
    toolsToggle: 'Open help panel'
  };
  return (
    <AppLayout
      id="app-layout"
      className={styles.baseLayout}
      headerSelector="#header"
      stickyNotifications
      toolsHide
      ariaLabels={appLayoutLabels}
      navigationOpen={navigationOpen}
      notifications={<Flashbar items={Object.values(notifications)} />}
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            {
              text: 'Service name',
              href: '#'
            },
            {
              text: 'Pages',
              href: '#'
            }
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      contentType="table"
      content={children}
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
    />
  );
}
