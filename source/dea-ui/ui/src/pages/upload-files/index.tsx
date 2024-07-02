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
import UploadFileBody from '../../components/upload-files/UploadFilesBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const caseId = searchParams.get('caseId');
  const filePath = searchParams.get('filePath');
  const caseName = searchParams.get('caseName');

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.uploadFilesLabel;

  if (
    !caseId ||
    typeof caseId !== 'string' ||
    !filePath ||
    typeof filePath !== 'string' ||
    !caseName ||
    typeof caseName !== 'string'
  ) {
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
      text: breadcrumbLabels.uploadFilesAndFoldersLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} activeHref="/" pageName={pageName}>
      <Box margin={{ bottom: 'l' }}>
        <UploadFileBody caseId={caseId} filePath={filePath} />
      </Box>
    </BaseLayout>
  );
};

export default Home;
