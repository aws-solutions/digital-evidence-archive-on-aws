/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import BaseLayout from '../components/BaseLayout';
import CaseTable from '../components/case-list-table/CaseTable';

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
      <CaseTable></CaseTable>
    </BaseLayout>
  );
};

export default Home;
