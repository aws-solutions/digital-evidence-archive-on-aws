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
  const { signOut } = useAuthentication();

  const profileActions = [{ id: 'signout', text: headerLabels.signout }];
  return (
    <TopNavigation
      id="header"
      className="header"
      i18nStrings={headerLabels}
      identity={{
        href: '/',
        title: settings.name,
      }}
      utilities={[
        {
          type: 'menu-dropdown',
          text: `Sherlock Holmes`,
          items: profileActions,
          onItemClick: async () => await signOut(),
        },
      ]}
    />
  );
}
