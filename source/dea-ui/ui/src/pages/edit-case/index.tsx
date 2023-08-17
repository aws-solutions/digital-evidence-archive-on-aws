/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import EditCaseBody from '../../components/edit-case/EditCaseBody';
import { useSettings } from '../../context/SettingsContext';

export interface EditCasePageProps {
  locale: string;
}

const EditCasePage: NextPage = () => {
  const router = useRouter();
  const { settings } = useSettings();
  const { caseId } = router.query;

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  if (!caseId || typeof caseId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: href_prefix,
    },
    {
      text: breadcrumbLabels.caseDetailsLabel,
      href: `${href_prefix}/case-detail?caseId=${caseId}`,
    },
    {
      text: breadcrumbLabels.editCaseLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <Box margin={{ bottom: 'l' }}>
        <EditCaseBody caseId={caseId} />
      </Box>
    </BaseLayout>
  );
};

export default EditCasePage;
