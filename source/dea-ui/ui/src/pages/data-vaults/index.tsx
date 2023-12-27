/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useListAllDataVaults } from '../../api/data-vaults';
import { breadcrumbLabels, dataVaultListLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import DataVaultsTable from '../../components/data-vaults-table/DataVaultsTable';

export default function DataVaultsPage() {
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: '#',
    },
  ];
  return (
    <BaseLayout breadcrumbs={breadcrumbs}>
      <DataVaultsTable
        detailPage="data-vault-detail"
        useDataVaultFetcher={useListAllDataVaults}
        headerLabel={dataVaultListLabels.dataVaultsLabel}
        headerDescription={dataVaultListLabels.dataVaultsPageDescription}
      />
    </BaseLayout>
  );
}
