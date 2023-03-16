/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { commonLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import UploadFileBody from '../../components/upload-files/UploadFilesBody';

export interface IHomeProps {
  locale: string;
}

const Home: NextPage = () => {
  const router = useRouter();
  const { caseId, filePath } = router.query;
  if (!caseId || typeof caseId !== 'string' || !filePath || typeof filePath !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: 'Digital Evidence Archive',
      href: '#',
    },
    {
      text: `Case ${caseId}`,
      href: '#',
    },
    {
      text: 'Upload folders/files',
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
