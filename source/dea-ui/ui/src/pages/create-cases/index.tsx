/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import BaseLayout from '../../components/BaseLayout';
import CreateCaseBody from '../../components/CreateCaseBody';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: 'Digital Evidence Archive',
      href: '#',
    },
    {
      text: 'Login',
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <Box margin={{ bottom: 'l' }}>
        <CreateCaseBody />
      </Box>
    </BaseLayout>
  );
};

export default Home;