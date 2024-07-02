/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useListAllCases } from '../../api/cases';
import { breadcrumbLabels, caseListLabels, navigationLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import CaseTable from '../../components/case-list-table/CaseTable';

export default function AllCasesPage() {
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: '#',
    },
  ];

  const pageName = navigationLabels.allSystemCasesLabel;

  return (
    <BaseLayout breadcrumbs={breadcrumbs} activeHref="/all-cases" pageName={pageName}>
      <CaseTable
        detailPage="manage-case"
        useCaseFetcher={useListAllCases}
        canCreate={false}
        headerLabel={caseListLabels.systemCasesLabel}
        headerDescription={caseListLabels.systemCasesPageDescription}
      />
    </BaseLayout>
  );
}
