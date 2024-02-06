/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useSearchParams } from 'next/navigation';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import EditCaseBody from '../../components/edit-case/EditCaseBody';
import { useSettings } from '../../context/SettingsContext';

export interface EditCasePageProps {
  locale: string;
}

const EditCasePage: NextPage = () => {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('caseId');
  const caseName = searchParams.get('caseName');
  const { settings } = useSettings();

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.editCaseLabel;

  if (!caseId || typeof caseId !== 'string' || !caseName || typeof caseName !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: href_prefix,
    },
    {
      text: caseName,
      href: `${href_prefix}/case-detail?caseId=${caseId}`,
    },
    {
      text: breadcrumbLabels.editCaseLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide pageName={pageName}>
      <Box margin={{ bottom: 'l' }}>
        <EditCaseBody caseId={caseId} />
      </Box>
    </BaseLayout>
  );
};

export default EditCasePage;
