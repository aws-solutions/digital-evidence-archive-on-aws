/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps, StatusIndicator } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useGetCaseById } from '../../api/cases';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import CaseDetailsBody from '../../components/case-details/CaseDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function CaseDetailsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const { caseId } = router.query;
  const { data, isLoading } = useGetCaseById(caseId);
  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
  }
  if (!data) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const href = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

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
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <CaseDetailsBody caseId={data.ulid} data={data} />
    </BaseLayout>
  );
}

export default CaseDetailsPage;
