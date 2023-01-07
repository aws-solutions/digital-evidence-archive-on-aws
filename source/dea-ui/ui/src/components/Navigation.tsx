/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import * as React from 'react';
import RouteGuard from './RouteGuard';

export interface NavigationProps {
  activeHref?: string;
  header?: SideNavigationProps.Header;
  onFollowHandler?: (ev: CustomEvent<SideNavigationProps.FollowDetail>) => void;
}

export default function Navigation({ activeHref, header, onFollowHandler }: NavigationProps): JSX.Element {
  const defaultNavHeader: SideNavigationProps.Header = {
    text: 'Digital Evidence Archive',
    href: '#/',
  };

  return (
    <RouteGuard>
      <SideNavigation
        data-testid="sideNavigation"
        activeHref={activeHref}
        header={header ? header : defaultNavHeader}
        onFollow={onFollowHandler}
      />
    </RouteGuard>
  );
}
