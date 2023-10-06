/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useListAllDataVaults, useListAllDataSyncTasks } from '../../api/data-vaults';
import { breadcrumbLabels, dataSyncTaskListLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import DataSyncTasksTable from '../../components/data-sync-tasks-table/DataSyncTasksTable';
import { useSettings } from '../../context/SettingsContext';

export default function DataSyncTasksPage() {
  const { settings } = useSettings();

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: baseUrl,
    },
    {
      text: breadcrumbLabels.dataSyncTasks,
      href: '#',
    },
  ];
  return (
    <BaseLayout breadcrumbs={breadcrumbs}>
      <DataSyncTasksTable
        detailPage="data-vault-detail"
        useDataVaultFetcher={useListAllDataVaults}
        useDataSyncTasksFectcher={useListAllDataSyncTasks}
        headerLabel={dataSyncTaskListLabels.dataSyncTasksLabel}
        headerDescription={dataSyncTaskListLabels.dataSyncTasksPageDescription}
      ></DataSyncTasksTable>
    </BaseLayout>
  );
}
