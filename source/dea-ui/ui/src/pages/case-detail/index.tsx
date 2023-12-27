/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
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
  const [caseName, setCaseName] = React.useState(breadcrumbLabels.caseDetailsLabel);
  const { settings } = useSettings();
  const { caseId } = router.query;
  if (!caseId || typeof caseId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const href = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href,
    },
    {
      text: caseName,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <CaseDetailsBody caseId={caseId} setCaseName={setCaseName} />
    </BaseLayout>
  );
}

export default CaseDetailsPage;
