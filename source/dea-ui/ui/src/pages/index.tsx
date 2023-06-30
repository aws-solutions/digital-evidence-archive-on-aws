/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAvailableEndpoints } from '../api/auth';
import { useListMyCases } from '../api/cases';
import { breadcrumbLabels, caseListLabels } from '../common/labels';
import BaseLayout from '../components/BaseLayout';
import CaseTable from '../components/case-list-table/CaseTable';

export interface IHomeProps {
  locale: string;
}

const MY_CASES_ENDPOINT = '/cases/my-casesGET';

const Home: NextPage = () => {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();

  useEffect(() => {
    const checkCaseUsage = async () => {
      if (availableEndpoints.isLoading) {
        return;
      }
      if (!availableEndpoints.data?.includes(MY_CASES_ENDPOINT)) {
        await router.push('/all-cases');
      }
    };

    void checkCaseUsage();
  }, [availableEndpoints, router]);

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
