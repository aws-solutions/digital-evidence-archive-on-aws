/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
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

  if (!caseId || typeof caseId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: `/${settings.stage}/ui`,
    },
    {
      text: breadcrumbLabels.caseDetailsLabel,
      href: `/${settings.stage}/ui/case-detail?caseId=${caseId}`,
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
