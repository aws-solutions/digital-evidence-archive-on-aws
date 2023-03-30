/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useListAllCases } from '../../api/cases';
import { caseListLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import CaseTable from '../../components/case-list-table/CaseTable';

export default function AllCasesPage() {
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
    <BaseLayout breadcrumbs={breadcrumbs}>
      <CaseTable
        detailPage="manage-case"
        useCaseFetcher={useListAllCases}
        canCreate={false}
        headerLabel={caseListLabels.systemCasesLabel}
      ></CaseTable>
    </BaseLayout>
  );
}
