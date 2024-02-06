/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps, StatusIndicator } from '@cloudscape-design/components';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useGetCaseById } from '../../api/cases';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import CaseDetailsBody from '../../components/case-details/CaseDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function CaseDetailsPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('caseId');
  const { settings } = useSettings();
  const { data, isLoading } = useGetCaseById(caseId);
  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
  }
  if (!data) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const href = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;
  const pageName = navigationLabels.caseDetailLabel;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href,
    },
    {
      text: data?.name ?? '',
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide pageName={pageName}>
      <CaseDetailsBody caseId={data.ulid} data={data} />
    </BaseLayout>
  );
}

export default CaseDetailsPage;
