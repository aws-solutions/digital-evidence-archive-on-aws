/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import FileDetailsBody from '../../components/file-details/FileDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function FileDetailPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const { caseId, fileId } = router.query;
  if (!caseId || typeof caseId !== 'string' || !fileId || typeof fileId !== 'string') {
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
      text: breadcrumbLabels.fileDetailsLabel,
      href: `#`,
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <FileDetailsBody caseId={caseId} fileId={fileId}></FileDetailsBody>
    </BaseLayout>
  );
}

export default FileDetailPage;
