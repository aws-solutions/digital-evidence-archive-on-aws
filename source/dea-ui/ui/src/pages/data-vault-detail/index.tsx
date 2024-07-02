/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import DataVaultDetailsBody from '../../components/data-vault-details/DataVaultDetailsBody';
import { useSettings } from '../../context/SettingsContext';

export interface IHomeProps {
  locale: string;
}

function DataVaultDetailsPage() {
  const searchParams = useSearchParams();
  const dataVaultId = searchParams.get('dataVaultId');
  const { settings } = useSettings();
  const [dataVaultName, setdataVaultName] = useState('');
  if (!dataVaultId || typeof dataVaultId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.dataVaultDetailLabel;

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
    <BaseLayout breadcrumbs={breadcrumbs} activeHref="/data-vaults" pageName={pageName}>
      <DataVaultDetailsBody dataVaultId={dataVaultId} setdataVaultName={setdataVaultName} />
    </BaseLayout>
  );
}

export default DataVaultDetailsPage;
