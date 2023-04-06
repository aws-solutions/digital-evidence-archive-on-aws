/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Spinner } from '@cloudscape-design/components';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useAvailableEndpoints } from '../api/auth';

export interface NavigationProps {
  initialHref?: string;
  header?: SideNavigationProps.Header;
  onFollowHandler?: (ev: CustomEvent<SideNavigationProps.FollowDetail>) => void;
}

const MY_CASES_ENDPOINT = '/cases/my-casesGET';
const ALL_CASES_ENDPOINT = '/cases/all-casesGET';

export default function Navigation({ initialHref, header }: NavigationProps): JSX.Element {
  const defaultNavHeader: SideNavigationProps.Header = {
    text: 'Digital Evidence Archive',
    href: '#/',
  };

  const router = useRouter();

  const [activeHref, setActiveHref] = React.useState(initialHref);

  const availableEndpoints = useAvailableEndpoints();
  if (availableEndpoints.isLoading) {
    return <Spinner />;
  }

  const navItems: SideNavigationProps.Item[] = [];
  if (availableEndpoints.data?.includes(MY_CASES_ENDPOINT)) {
    navItems.push({ type: 'link', text: 'My Cases', href: '/' });
  }

  if (availableEndpoints.data?.includes(ALL_CASES_ENDPOINT)) {
    navItems.push({ type: 'link', text: 'All System Cases', href: '/all-cases' });
  }

  navItems.push(
    { type: 'divider' },
    {
      type: 'link',
      text: 'Documentation',
      href: 'https://example.com',
      external: true,
    },
    {
      type: 'link',
      text: 'Download System Audit Log',
      href: '#',
      external: true,
    }
  );

  return (
    <SideNavigation
      data-testid="sideNavigation"
      activeHref={activeHref}
      header={header ?? defaultNavHeader}
      onFollow={(event) => {
        if (!event.detail.external) {
          event.preventDefault();
          setActiveHref(event.detail.href);
          void router.push(event.detail.href);
        }
      }}
      items={navItems}
    />
  );
}
