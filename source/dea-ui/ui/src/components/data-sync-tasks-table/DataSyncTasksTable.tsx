/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataSyncTask } from '@aws/dea-app/lib/models/data-sync-task';
import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Box,
  Button,
  ColumnLayout,
  Link,
  Modal,
  Pagination,
  PropertyFilter,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { createDataVaultExecution } from '../../api/data-vaults';
import { DeaListResult } from '../../api/models/api-results';
import {
  dataSyncTaskListLabels,
  commonTableLabels,
  paginationLabels,
  dataSyncTasksStatusLabels,
  commonLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { DeaDataSyncTaskDTO, TaskStatus } from '../../models/DataSyncTask';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './dataSyncTaskListDefinitions';

const RUN_DATA_SYNC_TASK_PATH = '/datavaults/tasks/{taskId}/executionsPOST';

export type DataVaultFetcherSignature = () => DeaListResult<DeaDataVault>;
export type DataSyncTaskFetcherSignature = () => DeaListResult<DeaDataSyncTask>;
export interface DataVaultsTableProps {
  useDataVaultFetcher: DataVaultFetcherSignature;
  useDataSyncTasksFectcher: DataSyncTaskFetcherSignature;
  detailPage: string;
  headerLabel: string;
  headerDescription: string;
}

function DataSyncTasksTable(props: DataVaultsTableProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data: dataSyncTasks, isLoading: dataSyncTasksLoading } = props.useDataSyncTasksFectcher();
  const { data: dataVaults, isLoading: dataVaultsLoading } = props.useDataVaultFetcher();
  const [selectedTask, setSelectedTask] = useState<DeaDataSyncTaskDTO[]>([]);
  const [showRunTaskModal, setShowRunTaskModal] = useState(false);
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const { pushNotification } = useNotifications();

  function fecthDataSyncTasks(
    dataSyncTasks: DeaDataSyncTask[],
    dataSyncTasksLoading: boolean,
    dataVaults: DeaDataVault[],
    dataVaultsLoading: boolean
  ): DeaListResult<DeaDataSyncTaskDTO> {
    return {
      data: dataSyncTasks.map((task) => ({
        ...task,
        dataVaultName: dataVaults.find((vault) => vault.ulid === task.dataVaultUlid)?.name,
      })),
      isLoading: dataSyncTasksLoading || dataVaultsLoading,
    };
  }

  const { data, isLoading } = useMemo(
    () => fecthDataSyncTasks(dataSyncTasks, dataSyncTasksLoading, dataVaults, dataVaultsLoading),
    [dataSyncTasks, dataSyncTasksLoading, dataVaults, dataVaultsLoading]
  );
  // Property and date filter collections
  const { items, filteredItemsCount, propertyFilterProps, collectionProps, paginationProps } = useCollection(
    data,
    {
      filtering: {
        empty: TableEmptyDisplay(
          dataSyncTaskListLabels.noDataSyncTasksLabel,
          dataSyncTaskListLabels.noDisplayLabel
        ),
        noMatch: TableNoMatchDisplay(dataSyncTaskListLabels.noDataSyncTasksMatchLabel),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteringFunction: (item: any, filteringText): any => {
          const filteringTextLowerCase = filteringText.toLowerCase();

          return (
            searchableColumns
              // eslint-disable-next-line security/detect-object-injection
              .map((key) => item[key])
              .some(
                (value) =>
                  typeof value === 'string' && value.toLowerCase().indexOf(filteringTextLowerCase) > -1
              )
          );
        },
      },
      propertyFiltering: {
        filteringProperties: filteringProperties,
        empty: TableEmptyDisplay(
          dataSyncTaskListLabels.noDataSyncTasksLabel,
          dataSyncTaskListLabels.noDisplayLabel
        ),
        noMatch: TableNoMatchDisplay(dataSyncTaskListLabels.noDataSyncTasksMatchLabel),
      },
      sorting: {},
      selection: {},
      pagination: {
        pageSize: 15,
      },
    }
  );

  function canRunDataSyncTaskVaults(endpoints: string[]): boolean {
    return selectedTask.length === 1 && endpoints.includes(RUN_DATA_SYNC_TASK_PATH);
  }

  function enableRunTaskModal() {
    setShowRunTaskModal(true);
  }

  function disableRunTaskModal() {
    setShowRunTaskModal(false);
  }

  async function runDataSyncTaskVaultHandler() {
    setIsSubmitLoading(true);
    try {
      await createDataVaultExecution(selectedTask[0].taskId, { taskArn: selectedTask[0].taskArn });
      pushNotification('success', dataSyncTaskListLabels.startTaskSuccessNotificationMessage);
      setSelectedTask([]);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
      disableRunTaskModal();
    }
  }

  function runTaskModal() {
    return (
      <Modal
        data-testid="run-task-modal"
        onDismiss={disableRunTaskModal}
        visible={showRunTaskModal && selectedTask.length !== 0}
        closeAriaLabel={commonLabels.closeModalAriaLabel}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={disableRunTaskModal}>
                {commonLabels.goBack}
              </Button>
              <Button
                data-testid="submit-run-task"
                variant="primary"
                onClick={runDataSyncTaskVaultHandler}
                disabled={IsSubmitLoading}
              >
                {commonLabels.runTask}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <TextContent>
            <h4>{dataSyncTaskListLabels.runTaskModalTitle}</h4>
            <p>{dataSyncTaskListLabels.runTaskSubtitle}</p>
          </TextContent>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <TextContent>
            <div>
              <h5>{commonTableLabels.dataSyncTaskIdHeader}</h5>
              <p>{selectedTask.length && selectedTask[0].taskId}</p>
            </div>
            <div>
              <h5>{commonTableLabels.sourceLocationIdHeader}</h5>
              <p>{selectedTask.length && locationIdFromArn(selectedTask[0].sourceLocationArn)}</p>
            </div>
          </TextContent>
          <TextContent>
            <div>
              <h5>{commonTableLabels.dataVaultNameHeader}</h5>
              <p>{selectedTask.length && (selectedTask[0].dataVaultName ?? '-')}</p>
            </div>
            <div>
              <h5>{commonTableLabels.destinationLocationIdHeader}</h5>
              <p>{selectedTask.length && locationIdFromArn(selectedTask[0].destinationLocationArn)}</p>
            </div>
          </TextContent>
        </ColumnLayout>
      </Modal>
    );
  }

  function dataVaultNameCell(deaDataSyncTask: DeaDataSyncTaskDTO) {
    if (!deaDataSyncTask.dataVaultUlid) {
      return '-';
    }
    return (
      <Link
        href={`${deaDataSyncTask.dataVaultUlid}`}
        onFollow={(e) => {
          e.preventDefault();
          return router.push(`/${props.detailPage}?dataVaultId=${e.detail.href}`);
        }}
      >
        {deaDataSyncTask.dataVaultName}
      </Link>
    );
  }

  function locationIdFromArn(locationArn: string | undefined) {
    if (!locationArn) {
      return '-';
    }
    return locationArn.split('/')[1];
  }

  function statusCell(deaDataSyncTask: DeaDataSyncTaskDTO) {
    if (!deaDataSyncTask.status || deaDataSyncTask.status === TaskStatus.UNAVAILABLE) {
      return <StatusIndicator type="stopped">{dataSyncTasksStatusLabels.unavailable}</StatusIndicator>;
    } else if (deaDataSyncTask.status == TaskStatus.AVAILABLE) {
      return <StatusIndicator>{dataSyncTasksStatusLabels.available}</StatusIndicator>;
    } else if (deaDataSyncTask.status == TaskStatus.QUEUED) {
      return <StatusIndicator type="pending">{dataSyncTasksStatusLabels.queued}</StatusIndicator>;
    } else {
      // TaskStatus.RUNNING
      return <StatusIndicator type="in-progress">{dataSyncTasksStatusLabels.running}</StatusIndicator>;
    }
  }

  return (
    <Table
      {...collectionProps}
      data-testid="data-sync-tasks-table"
      onSelectionChange={({ detail }) => setSelectedTask(detail.selectedItems)}
      selectedItems={selectedTask}
      selectionType="single"
      trackBy="ulid"
      loading={isLoading}
      variant="full-page"
      items={items}
      loadingText={dataSyncTaskListLabels.loading}
      resizableColumns={true}
      empty={TableEmptyDisplay(
        dataSyncTaskListLabels.noDataSyncTasksLabel,
        dataSyncTaskListLabels.noDisplayLabel
      )}
      header={
        <TableHeader
          data-testid="data-sync-tasks-header"
          variant="awsui-h1-sticky"
          title={props.headerLabel}
          description={props.headerDescription}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              {runTaskModal()}
              <Button
                disabled={!canRunDataSyncTaskVaults(availableEndpoints.data)}
                data-testid="data-sync-run-task-button"
                variant="primary"
                onClick={enableRunTaskModal}
              >
                {dataSyncTaskListLabels.runDataSyncTaskLabel}
              </Button>
            </SpaceBetween>
          }
          totalItems={data}
        />
      }
      columnDefinitions={[
        {
          id: 'taskId',
          header: commonTableLabels.dataSyncTaskIdHeader,
          cell: (e) => e.taskId,
          width: 350,
          minWidth: 220,
          sortingField: 'taskId',
        },
        {
          id: 'sourceLocationArn',
          header: commonTableLabels.sourceLocationIdHeader,
          cell: (e) => locationIdFromArn(e.sourceLocationArn),
          width: 220,
          minWidth: 165,
          sortingField: 'sourceLocationArn',
        },
        {
          id: 'destinationLocationArn',
          header: commonTableLabels.destinationLocationIdHeader,
          cell: (e) => locationIdFromArn(e.destinationLocationArn),
          width: 220,
          minWidth: 165,
          sortingField: 'destinationLocationArn',
        },
        {
          id: 'dataVaultName',
          header: commonTableLabels.dataVaultNameHeader,
          cell: dataVaultNameCell,
          width: 350,
          minWidth: 220,
          sortingField: 'dataVaultName',
        },
        {
          id: 'created',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => formatDateFromISOString(e.created),
          width: 200,
          minWidth: 165,
          sortingField: 'created',
        },
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: statusCell,
          width: 220,
          minWidth: 165,
          sortingField: 'status',
        },
      ]}
      filter={
        <SpaceBetween direction="vertical" size="xs">
          <PropertyFilter
            {...propertyFilterProps}
            countText={getFilterCounterText(filteredItemsCount)}
            i18nStrings={i18nStrings}
            filteringOptions={filteringOptions}
            expandToViewport={true}
          />
        </SpaceBetween>
      }
      pagination={<Pagination {...paginationProps} ariaLabels={paginationLabels} />}
    />
  );
}

const getFilterCounterText = (count: number | undefined): string =>
  `${count} ${count === 1 ? 'match' : 'matches'}`;
export default DataSyncTasksTable;
