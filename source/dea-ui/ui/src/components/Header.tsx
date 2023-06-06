/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import TopNavigation from '@cloudscape-design/components/top-navigation';
import * as React from 'react';
import { headerLabels } from '../common/labels';
import { useAuthentication } from '../context/AuthenticationContext';
import { useSettings } from '../context/SettingsContext';

export default function Header(): JSX.Element {
  const { settings } = useSettings();
  const { user, signOut, isLoggedIn } = useAuthentication();

  const profileActions = [{ id: 'signout', text: headerLabels.signout }];
  const href = process.env.NEXT_PUBLIC_IS_USING_CUSTOM_DOMAIN ? '/ui' : `/${settings.stage}/ui`;
  return (
    <TopNavigation
      id="header"
      className="header"
      data-testid="header-top-navigation"
      i18nStrings={headerLabels}
      identity={{
        href,
        title: isLoggedIn ? settings.name : `${settings.name}${headerLabels.notLoggedIn}`,
      }}
      utilities={[
        {
          type: 'menu-dropdown',
          text: user.username,
          items: profileActions,
          onItemClick: async () => signOut(),
        },
      ]}
    />
  );
}
