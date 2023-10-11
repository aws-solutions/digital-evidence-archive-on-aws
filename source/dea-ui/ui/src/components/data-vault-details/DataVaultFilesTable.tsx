/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { PropertyFilterProperty, useCollection } from '@cloudscape-design/collection-hooks';
import {
  BreadcrumbGroup,
  Button,
  Checkbox,
  ColumnLayout,
  Header,
  Icon,
  Link,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import React, { useState } from 'react';
import {
  commonTableLabels,
  dataVaultDetailLabels,
  filesListLabels,
  paginationLabels,
} from '../../common/labels';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';

function DataVaultFilesTable(): JSX.Element {
  const [displayFilesWithoutACase, setDisplayFilesWithoutACase] = useState(false);
  // Property and date filter collections
  const [filesTableState] = useState({
    textFilter: '',
    basePath: '/',
  });
  const filteringProperties: readonly PropertyFilterProperty[] = [
    {
      key: 'name',
      operators: ['=', '!=', ':', '!:'],
      propertyLabel: 'File Name',
      groupValuesLabel: 'File Name Values',
    },
  ];

  const { items, filterProps, collectionProps, paginationProps } = useCollection([], {
    filtering: {
      empty: TableEmptyDisplay(dataVaultDetailLabels.noFilesLabel, dataVaultDetailLabels.noFilesDisplayLabel),
      noMatch: TableNoMatchDisplay(dataVaultDetailLabels.noFilesLabel),
    },
    propertyFiltering: {
      filteringProperties: filteringProperties,
      empty: TableEmptyDisplay(dataVaultDetailLabels.noFilesLabel, dataVaultDetailLabels.noFilesDisplayLabel),
      noMatch: TableNoMatchDisplay(dataVaultDetailLabels.noFilesLabel),
    },
    pagination: {
      defaultPage: 0,
      pageSize: 50,
    },
    sorting: {},
    selection: {},
  });

  const pathParts = filesTableState.basePath.split('/');
  const breadcrumbItems = [{ text: '/', href: '#' }];

  let hrefString = '#';
  pathParts.forEach((part) => {
    if (part !== '') {
      hrefString += part + '#';
      breadcrumbItems.push({ text: part, href: hrefString });
    }
  });

  function tableActions() {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button disabled={true} data-testid="data-vault-associate-button" variant="primary">
          {commonTableLabels.associateButtonLabel}
        </Button>
      </SpaceBetween>
    );
  }

  function tableHeaderDescription(): React.ReactNode {
    return (
      <>
        {dataVaultDetailLabels.filesTableHeaderDescription}{' '}
        <Link
          external
          href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
        >
          {commonTableLabels.fileTransferInstructionsText}
        </Link>
      </>
    );
  }

  // table header Element
  const tableHeader = (
    <Header variant="h2" description={tableHeaderDescription()} actions={tableActions()}>
      <SpaceBetween direction="horizontal" size="xs">
        <span>{`${dataVaultDetailLabels.filesLabel} (0)`}</span>
        <BreadcrumbGroup data-testid="file-breadcrumb" items={breadcrumbItems} ariaLabel="Breadcrumbs" />
      </SpaceBetween>
    </Header>
  );

  // empty table Element
  const emptyConfig = TableEmptyDisplay(
    dataVaultDetailLabels.noFilesLabel,
    dataVaultDetailLabels.noFilesDisplayLabel,
    <>
      <Button
        variant="primary"
        onClick={() =>
          window.open(
            'https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html'
          )
        }
      >
        {commonTableLabels.implementationGuideLabel} <Icon name="external" variant="inverted" />
      </Button>
    </>
  );

  // pagination element
  const tablePagination = <Pagination {...paginationProps} ariaLabels={paginationLabels} />;

  return (
    <Table
      {...collectionProps}
      data-testid="file-table"
      selectionType="multi"
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.fileNameHeader,
          cell: () => '',
          width: 400,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'fileType',
          header: commonTableLabels.fileTypeHeader,
          cell: () => '',
          width: 170,
          minWidth: 170,
          sortingField: 'fileType',
        },
        {
          id: 'size',
          header: commonTableLabels.fileSizeHeader,
          cell: () => '',
          width: 100,
          minWidth: 100,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: commonTableLabels.dateUploadedHeader,
          cell: () => '',
          width: 165,
          minWidth: 165,
          sortingField: 'uploadDate',
        },
        {
          id: 'executionId',
          header: commonTableLabels.executionIdHeader,
          cell: () => '',
          width: 150,
          minWidth: 150,
          sortingField: 'executionId',
        },
        {
          id: 'caseAssociation',
          header: commonTableLabels.caseAssociationHeader,
          cell: () => '',
          width: 100,
          minWidth: 100,
          sortingField: 'caseAssociation',
        },
      ]}
      items={items}
      loadingText={filesListLabels.loading}
      resizableColumns
      empty={emptyConfig}
      filter={
        <ColumnLayout columns={2}>
          <TextFilter
            data-testid="files-text-filter"
            {...filterProps}
            filteringPlaceholder={filesListLabels.searchLabel}
          />
          <Checkbox
            disabled={true}
            onChange={({ detail }) => setDisplayFilesWithoutACase(detail.checked)}
            checked={displayFilesWithoutACase}
          >
            {dataVaultDetailLabels.displayFilesCheckboxLabel}
          </Checkbox>
        </ColumnLayout>
      }
      header={tableHeader}
      pagination={tablePagination}
    />
  );
}

export default DataVaultFilesTable;
