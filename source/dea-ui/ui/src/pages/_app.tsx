/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import '@cloudscape-design/global-styles/index.css';
import type { AppProps } from 'next/app';
import Header from '../components/Header';
import { AuthenticationProvider } from '../context/AuthenticationContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { SettingsProvider } from '../context/SettingsContext';

// eslint-disable-next-line @typescript-eslint/naming-convention
function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <SettingsProvider>
      <AuthenticationProvider>
        <NotificationsProvider>
          <Header />
          <Component {...pageProps} />
          <footer id="footer"></footer>
        </NotificationsProvider>
      </AuthenticationProvider>
    </SettingsProvider>
  );
}

export default App;
