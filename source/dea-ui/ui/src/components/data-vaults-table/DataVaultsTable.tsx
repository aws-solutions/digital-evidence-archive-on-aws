/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Link, Pagination, PropertyFilter, SpaceBetween, Table } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useAvailableEndpoints } from '../../api/auth';
import { DeaListResult } from '../../api/models/api-results';
import { dataVaultListLabels, commonTableLabels, paginationLabels } from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import { canCreateDataVaults } from '../../helpers/userActionSupport';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './dataVaultListDefinitions';

export type DataVaultFetcherSignature = () => DeaListResult<DeaDataVault>;
export interface DataVaultsTableProps {
  useDataVaultFetcher: DataVaultFetcherSignature;
  detailPage: string;
  headerLabel: string;
  headerDescription: string;
}

function DataVaultsTable(props: DataVaultsTableProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data, isLoading } = props.useDataVaultFetcher();

  // Property and date filter collections
  const { items, filteredItemsCount, propertyFilterProps, collectionProps, paginationProps } = useCollection(
    data,
    {
      filtering: {
        empty: TableEmptyDisplay(dataVaultListLabels.noDataVaultsLabel, dataVaultListLabels.noDisplayLabel),
        noMatch: TableNoMatchDisplay(dataVaultListLabels.noDataVaultsMatchLabel),
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
        empty: TableEmptyDisplay(dataVaultListLabels.noDataVaultsLabel, dataVaultListLabels.noDisplayLabel),
        noMatch: TableNoMatchDisplay(dataVaultListLabels.noDataVaultsMatchLabel),
      },
      sorting: {},
      selection: {},
      pagination: {
        pageSize: 15,
      },
    }
  );

  function createNewDataVaultHandler() {
    return router.push('/create-data-vaults');
  }

  function nameCell(deaDataVault: DeaDataVault) {
    return (
      <Link
        href={`${deaDataVault.ulid}`}
        onFollow={(e) => {
          e.preventDefault();
          return router.push(`/${props.detailPage}?dataVaultId=${e.detail.href}`);
        }}
      >
        {deaDataVault.name}
      </Link>
    );
  }

  return (
    <Table
      {...collectionProps}
      data-testid="data-vaults-table"
      selectionType="single"
      trackBy="ulid"
      loading={isLoading}
      variant="full-page"
      items={items}
      loadingText={dataVaultListLabels.loading}
      resizableColumns={true}
      empty={TableEmptyDisplay(dataVaultListLabels.noDataVaultsLabel, dataVaultListLabels.noDisplayLabel)}
      header={
        <TableHeader
          data-testid="case-table-header"
          variant="awsui-h1-sticky"
          title={props.headerLabel}
          description={props.headerDescription}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                disabled={!canCreateDataVaults(availableEndpoints.data)}
                data-testid="create-data-vault-button"
                variant="primary"
                onClick={createNewDataVaultHandler}
              >
                {dataVaultListLabels.createNewDataVaultLabel}
              </Button>
            </SpaceBetween>
          }
          totalItems={data}
        />
      }
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.nameHeader,
          cell: nameCell,
          width: 350,
          minWidth: 220,
          sortingField: 'name',
        },
        {
          id: 'objectCount',
          header: commonTableLabels.objectCounterHeader,
          cell: (e) => e.objectCount,
          width: 220,
          minWidth: 165,
          sortingField: 'objectCount',
        },
        {
          id: 'totalSize',
          header: commonTableLabels.totalSize,
          cell: (e) => formatFileSize(e.totalSizeBytes),
          width: 220,
          minWidth: 165,
          sortingField: 'totalSizeBytes',
        },
        {
          id: 'created',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => formatDateFromISOString(e.created),
          width: 200,
          minWidth: 165,
          sortingField: 'created',
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
export default DataVaultsTable;
