/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import DataVaultDetailsBody from '../../components/data-vault-details/DataVaultDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function DataVaultDetailsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [dataVaultName, setdataVaultName] = useState('');
  const { dataVaultId } = router.query;
  if (!dataVaultId || typeof dataVaultId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: `${baseUrl}/data-vaults`,
    },
    {
      text: dataVaultName,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} activeHref="/data-vaults">
      <DataVaultDetailsBody dataVaultId={dataVaultId} setdataVaultName={setdataVaultName} />
    </BaseLayout>
  );
}

export default DataVaultDetailsPage;
