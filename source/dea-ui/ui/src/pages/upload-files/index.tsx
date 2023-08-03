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
import UploadFileBody from '../../components/upload-files/UploadFilesBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const router = useRouter();
  const { settings } = useSettings();
  const { caseId, filePath } = router.query;

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  if (!caseId || typeof caseId !== 'string' || !filePath || typeof filePath !== 'string') {
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
      text: breadcrumbLabels.uploadFilesAndFoldersLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <Box margin={{ bottom: 'l' }}>
        <UploadFileBody caseId={caseId} filePath={filePath} />
      </Box>
    </BaseLayout>
  );
};

export default Home;
