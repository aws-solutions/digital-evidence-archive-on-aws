/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useListMyCases } from '../api/cases';
import { breadcrumbLabels, caseListLabels } from '../common/labels';
import BaseLayout from '../components/BaseLayout';
import CaseTable from '../components/case-list-table/CaseTable';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs}>
      <CaseTable
        detailPage="case-detail"
        useCaseFetcher={useListMyCases}
        canCreate={true}
        headerLabel={caseListLabels.casesLabel}
        headerDescription={caseListLabels.casesPageDescription}
      ></CaseTable>
    </BaseLayout>
  );
};

export default Home;
