/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import FileDetailsBody from '../../components/file-details/FileDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function FileDetailPage() {
  const router = useRouter();
  const [fileName, setFileName] = React.useState('');
  const { settings } = useSettings();
  const { caseId, fileId, caseName } = router.query;
  if (
    !caseId ||
    typeof caseId !== 'string' ||
    !fileId ||
    typeof fileId !== 'string' ||
    !caseName ||
    typeof caseName !== 'string'
  ) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.fileDetailLabel;

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
      text: fileName,
      href: `#`,
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide pageName={pageName}>
      <FileDetailsBody caseId={caseId} fileId={fileId} setFileName={setFileName} />
    </BaseLayout>
  );
}

export default FileDetailPage;
