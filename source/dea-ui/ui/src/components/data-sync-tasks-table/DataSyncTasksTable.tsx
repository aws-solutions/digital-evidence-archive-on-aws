/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataSyncTask } from '@aws/dea-app/lib/models/data-sync-task';
import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Link,
  Modal,
  Pagination,
  Popover,
  PropertyFilter,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  TextContent,
} from '@cloudscape-design/components';
import { useRouter } from 'next/navigation';
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
  accessibilityLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDateFromISOString, formatDateTimeFromISOString } from '../../helpers/dateHelper';
import { DeaDataSyncTaskDTO, TaskStatus } from '../../models/DataSyncTask';
import ActionContainer from '../common-components/ActionContainer';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStringsForPropertyFilter } from '../common-components/commonDefinitions';
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
  headerDescription: string | JSX.Element;
}

function DataSyncTasksTable(props: DataVaultsTableProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data: dataSyncTasks, isLoading: dataSyncTasksLoading } = props.useDataSyncTasksFectcher();
  const { data: dataVaults, isLoading: dataVaultsLoading } = props.useDataVaultFetcher();
  const [selectedTasks, setSelectedTasks] = useState<DeaDataSyncTaskDTO[]>([]);
  const [showRunTaskModal, setShowRunTaskModal] = useState(false);
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const { pushNotification } = useNotifications();

  function fetchDataSyncTasks(
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
    () => fetchDataSyncTasks(dataSyncTasks, dataSyncTasksLoading, dataVaults, dataVaultsLoading),
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
      sorting: { defaultState: { isDescending: true, sortingColumn: { sortingField: 'created' } } },
      selection: {},
      pagination: {
        pageSize: 15,
      },
    }
  );

  function enableRunTaskModal() {
    setShowRunTaskModal(true);
  }

  function disableRunTaskModal() {
    setShowRunTaskModal(false);
  }

  async function runDataSyncTaskVaultHandler() {
    setIsSubmitLoading(true);
    try {
      await createDataVaultExecution(selectedTasks[0].taskId, { taskArn: selectedTasks[0].taskArn });
      pushNotification('success', dataSyncTaskListLabels.startTaskSuccessNotificationMessage);
      setSelectedTasks([]);
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
        size="medium"
        onDismiss={disableRunTaskModal}
        visible={showRunTaskModal && selectedTasks.length !== 0}
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
                {IsSubmitLoading ? <Spinner variant="disabled" /> : null}
                {commonLabels.runTask}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <TextContent>
            <h2>{dataSyncTaskListLabels.runTaskModalTitle}</h2>
            <p>
              {dataSyncTaskListLabels.runTaskModalDescription}

              <Popover
                size="small"
                position="top"
                triggerType="custom"
                dismissButton={false}
                content={<StatusIndicator type="success">{commonLabels.linkCopiedLabel}</StatusIndicator>}
              >
                <Button
                  iconName="copy"
                  variant="inline-icon"
                  data-testid="copy-datasync-link-button"
                  onClick={() => {
                    void navigator.clipboard.writeText('https://aws.amazon.com/datasync/');
                  }}
                />
                {commonLabels.copyLinkLabel}
              </Popover>
            </p>
          </TextContent>
        }
      >
        <SpaceBetween direction="vertical" size="l">
          <TextContent>
            <h5>{commonTableLabels.dataSyncTaskIdHeader}</h5>
            <p>{selectedTasks.length && selectedTasks[0].taskId}</p>
          </TextContent>
          <TextContent>
            <h5>{commonTableLabels.dataVaultNameHeader}</h5>
            <p>{selectedTasks.length && (selectedTasks[0].dataVaultName ?? '-')}</p>
          </TextContent>
          <TextContent>
            <h4>{dataSyncTaskListLabels.runTaskLocationsLabel}</h4>
          </TextContent>
          <ColumnLayout columns={2} variant="text-grid">
            <TextContent>
              <div>
                <h5>{commonTableLabels.sourceLocationIdHeader}</h5>
                <p>{selectedTasks.length && locationIdFromArn(selectedTasks[0].sourceLocationArn)}</p>
              </div>
            </TextContent>
            <TextContent>
              <div>
                <h5>{commonTableLabels.destinationLocationIdHeader}</h5>
                <p>{selectedTasks.length && locationIdFromArn(selectedTasks[0].destinationLocationArn)}</p>
              </div>
            </TextContent>
          </ColumnLayout>
          <Alert statusIconAriaLabel="Warning" type="warning">
            {dataSyncTaskListLabels.runTaskModalAlertText}
          </Alert>
        </SpaceBetween>
      </Modal>
    );
  }

  function dataVaultNameCell(deaDataSyncTask: DeaDataSyncTaskDTO) {
    if (!deaDataSyncTask.dataVaultUlid) {
      return '-';
    }
    if (!deaDataSyncTask.dataVaultName) {
      return deaDataSyncTask.dataVaultUlid;
    }
    return (
      <Link
        data-test-id={deaDataSyncTask.taskId}
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

  function tableHeaderDescription(): React.ReactNode {
    return (
      <>
        {props.headerDescription}{' '}
        <Link
          external
          externalIconAriaLabel={accessibilityLabels.implementationGuideLinkLabel}
          ariaLabel={accessibilityLabels.implementationGuideLinkLabel}
          href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
        >
          {commonTableLabels.implementationGuideLabel}
        </Link>
        .
      </>
    );
  }

  return (
    <Table
      {...collectionProps}
      data-testid="data-sync-tasks-table"
      onSelectionChange={({ detail }) => setSelectedTasks(detail.selectedItems)}
      selectedItems={selectedTasks}
      selectionType="single"
      isItemDisabled={(item) => !item.dataVaultName}
      trackBy="taskId"
      loading={isLoading}
      variant="full-page"
      ariaLabels={{
        tableLabel: dataSyncTaskListLabels.dataSyncTasksLabel,
        selectionGroupLabel: commonTableLabels.tableCheckboxSelectionGroupLabel,
        allItemsSelectionLabel: ({ selectedItems }) =>
          `${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'items'} selected`,
        itemSelectionLabel: ({ selectedItems }, item) => {
          const isItemSelected = selectedItems.filter((i) => i.fileName === item.fileName).length;
          return `${item.fileName} is${isItemSelected ? '' : ' not'} selected`;
        },
      }}
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
          description={tableHeaderDescription()}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              {runTaskModal()}
              <ActionContainer required={RUN_DATA_SYNC_TASK_PATH} actions={availableEndpoints.data}>
                <Button
                  disabled={selectedTasks.length === 0}
                  data-testid="data-sync-run-task-button"
                  variant="primary"
                  onClick={enableRunTaskModal}
                >
                  {dataSyncTaskListLabels.runDataSyncTaskLabel}
                </Button>
              </ActionContainer>
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
          width: 200,
          minWidth: 165,
          sortingField: 'taskId',
        },
        {
          id: 'dataVaultName',
          header: commonTableLabels.dataVaultNameHeader,
          cell: dataVaultNameCell,
          width: 200,
          minWidth: 165,
          sortingField: 'dataVaultName',
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
          width: 250,
          minWidth: 220,
          sortingField: 'destinationLocationArn',
        },
        {
          id: 'created',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => formatDateFromISOString(e.created),
          width: 165,
          minWidth: 165,
          sortingField: 'created',
        },
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: statusCell,
          width: 120,
          minWidth: 100,
          sortingField: 'status',
        },
        {
          id: 'lastExecutionCompleted',
          header: commonTableLabels.lastExecutionCompletedHeader,
          cell: (e) => formatDateTimeFromISOString(e.lastExecutionCompleted),
          width: 260,
          minWidth: 260,
          sortingField: 'lastExecutionCompleted',
        },
      ]}
      filter={
        <SpaceBetween direction="vertical" size="xs">
          <PropertyFilter
            {...propertyFilterProps}
            countText={getFilterCounterText(filteredItemsCount)}
            i18nStrings={i18nStringsForPropertyFilter}
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
