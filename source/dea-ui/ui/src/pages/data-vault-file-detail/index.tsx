/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import DataVaultFileDetailsBody from '../../components/data-vault-file-details/DataVaultFileDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function DataVaultFileDetailPage() {
  const searchParams = useSearchParams();
  const dataVaultId = searchParams.get('dataVaultId');
  const fileId = searchParams.get('fileId');
  const dataVaultName = searchParams.get('dataVaultName');

  const [fileName, setFileName] = React.useState('');
  const { settings } = useSettings();

  if (
    !dataVaultId ||
    typeof dataVaultId !== 'string' ||
    !fileId ||
    typeof fileId !== 'string' ||
    !dataVaultName ||
    typeof dataVaultName !== 'string'
  ) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.dataVaultFileDetailLabel;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: `${baseUrl}/data-vaults`,
    },
    {
      text: dataVaultName,
      href: `${baseUrl}/data-vault-detail?dataVaultId=${dataVaultId}`,
    },
    {
      text: fileName,
      href: `#`,
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} activeHref="/data-vaults" pageName={pageName}>
      <DataVaultFileDetailsBody dataVaultId={dataVaultId} fileId={fileId} setFileName={setFileName} />
    </BaseLayout>
  );
}

export default DataVaultFileDetailPage;
