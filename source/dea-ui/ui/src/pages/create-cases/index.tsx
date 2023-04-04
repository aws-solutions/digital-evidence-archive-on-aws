/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { breadcrumbLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import CreateCaseBody from '../../components/create-case/CreateCaseBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const { settings } = useSettings();
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: `/${settings.stage}/ui`,
    },
    {
      text: breadcrumbLabels.createNewCaseLabel,
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
