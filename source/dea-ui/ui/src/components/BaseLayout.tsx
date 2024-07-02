/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Head from 'next/head';
import * as React from 'react';
import { helpPanelContent } from '../common/HelpPanelContent';
import { layoutLabels } from '../common/labels';
import Navigation from '../components/Navigation';
import { useHelp } from '../context/HelpContext';
import { useSettings } from '../context/SettingsContext';
import { Notifications } from './common-components/Notifications';

export interface LayoutProps {
  navigationHide?: boolean;
  children: React.ReactNode;
  breadcrumbs: BreadcrumbGroupProps.Item[];
  activeHref?: string;
  pageName?: string;
  toolsShow?: boolean;
  initialHelpPanelPage?: string;
}

export default function BaseLayout({
  navigationHide,
  children,
  breadcrumbs,
  activeHref = '#/',
  pageName,
  toolsShow = false,
  initialHelpPanelPage = 'default',
}: LayoutProps): JSX.Element {
  const [navigationOpen, setNavigationOpen] = React.useState(false);
  const { settings } = useSettings();
  const { state, setHelpPanelTopic, setToolsOpen, appLayoutRef } = useHelp();

  const appLayoutLabels: AppLayoutProps.Labels = layoutLabels;

  React.useEffect(() => {
    setHelpPanelTopic(initialHelpPanelPage);
  }, [setHelpPanelTopic, initialHelpPanelPage]);

  return (
    <>
      <Head>
        <title>
          {settings.name} - {pageName}
        </title>
        <meta name="description" content={settings.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <AppLayout
        ref={appLayoutRef}
        toolsOpen={state.toolsOpen}
        onToolsChange={(event) => setToolsOpen(event.detail.open)}
        toolsWidth={330}
        toolsHide={!toolsShow}
        tools={helpPanelContent[state.helpPanelTopic]}
        headerSelector="#header"
        ariaLabels={appLayoutLabels}
        navigationOpen={navigationOpen}
        navigationHide={navigationHide}
        navigation={<Navigation initialHref={activeHref} />}
        breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Files" />}
        content={children}
        onNavigationChange={({ detail }) => {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          setNavigationOpen(detail.open);
        }}
        notifications={<Notifications />}
      />
    </>
  );
}
