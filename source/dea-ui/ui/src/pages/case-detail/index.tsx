/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { commonLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import CaseDetailsBody from '../../components/case-details/CaseDetailsBody';

export interface IHomeProps {
  locale: string;
}

function CaseDetailsPage() {
  const router = useRouter();
  const { caseId } = router.query;
  if (!caseId || typeof caseId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }
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
      <CaseDetailsBody caseId={caseId}></CaseDetailsBody>
    </BaseLayout>
  );
}

export default CaseDetailsPage;
