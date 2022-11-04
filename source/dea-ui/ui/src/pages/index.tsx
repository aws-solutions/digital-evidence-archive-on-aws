/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import type { NextPage } from 'next';
import Head from 'next/head';
import Hero from '../components/Hero';
import { useNotifications } from '../context/NotificationContext';
import { useSettings } from '../context/SettingsContext';

export interface HomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const { settings } = useSettings();
  const { displayNotification } = useNotifications();

  displayNotification('temp', {
    type: 'info',
    header: 'This is a sample notification',
    content: (
      <span>
        We can use HTML here for the notifaction body
        <Link href="#/" color="inverted">
          link
        </Link>
        , or{' '}
        <Link external href="#/" color="inverted">
          another link
        </Link>
        .
      </span>
    ),
  });

  return (
    <Box margin={{ bottom: 'l' }}>
      <Head>
        <title>{settings.name}</title>
        <meta name="description" content={settings.description} />
        <link rel="icon" href={settings.favicon} />
      </Head>

      <Hero />
    </Box>
  );
};

export default Home;
