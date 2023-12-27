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
import DataVaultFileDetailsBody from '../../components/data-vault-file-details/DataVaultFileDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function DataVaultFileDetailPage() {
  const router = useRouter();
  const [fileName, setFileName] = React.useState(breadcrumbLabels.fileDetailsLabel);
  const { settings } = useSettings();
  const { dataVaultId, fileId } = router.query;
  if (!dataVaultId || typeof dataVaultId !== 'string' || !fileId || typeof fileId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: `${baseUrl}/data-vaults`,
    },
    {
      text: breadcrumbLabels.dataVaultDetailsLabel,
      href: `${baseUrl}/data-vault-detail?dataVaultId=${dataVaultId}`,
    },
    {
      text: fileName,
      href: `#`,
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs}>
      <DataVaultFileDetailsBody dataVaultId={dataVaultId} fileId={fileId} setFileName={setFileName} />
    </BaseLayout>
  );
}

export default DataVaultFileDetailPage;
