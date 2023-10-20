/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVaultFile } from '@aws/dea-app/lib/models/data-vault-file';
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
  StatusIndicator,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { useListDataVaultFiles } from '../../api/data-vaults';
import {
  commonLabels,
  commonTableLabels,
  dataVaultDetailLabels,
  filesListLabels,
  paginationLabels,
} from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { DataVaultDetailsBodyProps } from './DataVaultDetailsBody';

function DataVaultFilesTable(props: DataVaultDetailsBodyProps): JSX.Element {
  const router = useRouter();
  const [displayFilesWithoutACase, setDisplayFilesWithoutACase] = useState(false);
  // Property and date filter collections
  const [filesTableState, setFilesTableState] = useState({
    textFilter: '',
    basePath: '/',
  });
  const { data, isLoading } = useListDataVaultFiles(props.dataVaultId, filesTableState.basePath);
  const [selectedFiles, setSelectedFiles] = React.useState<DeaDataVaultFile[]>([]);

  const filteringProperties: readonly PropertyFilterProperty[] = [
    {
      key: 'fileName',
      operators: ['=', '!=', ':', '!:'],
      propertyLabel: 'File Name',
      groupValuesLabel: 'File Name Values',
    },
  ];

  const { items, filterProps, collectionProps, paginationProps } = useCollection(data, {
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

  if (isLoading) {
    return <h1>{commonLabels.loadingLabel}</h1>;
  }

  const pathParts = filesTableState.basePath.split('/');
  const breadcrumbItems = [{ text: '/', href: '#' }];

  let hrefString = '#';
  pathParts.forEach((part) => {
    if (part !== '') {
      hrefString += part + '#';
      breadcrumbItems.push({ text: part, href: hrefString });
    }
  });

  const fileFolderCell = (dataVaultFile: DeaDataVaultFile) => {
    return !dataVaultFile.isFile ? (
      <Button
        data-testid={`${dataVaultFile.fileName}-button`}
        iconName="folder"
        variant="link"
        onClick={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          setFilesTableState((state) => ({
            ...state,
            basePath: filesTableState.basePath + dataVaultFile.fileName + '/',
          }));
        }}
      >
        {dataVaultFile.fileName}
      </Button>
    ) : (
      <Button
        data-testid={`${dataVaultFile.fileName}-file-button`}
        iconName="file"
        variant="link"
        onClick={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          return router.push(
            `/data-vault-file-detail?dataVaultId=${dataVaultFile.dataVaultUlid}&fileId=${dataVaultFile.ulid}`
          );
        }}
      >
        {dataVaultFile.fileName}
      </Button>
    );
  };

  function statusCell(/*dataVaultFile: DeaDataVaultFile*/) {
    return <StatusIndicator type="stopped">{dataVaultDetailLabels.noAssociatedLabel}</StatusIndicator>;
  }

  function tableActions() {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          disabled={selectedFiles.length === 0}
          data-testid="data-vault-associate-button"
          variant="primary"
        >
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
          {commonTableLabels.implementationGuideLabel}
        </Link>
      </>
    );
  }

  // table header Element
  const tableHeader = (
    <Header variant="h2" description={tableHeaderDescription()} actions={tableActions()}>
      <SpaceBetween direction="horizontal" size="xs">
        <span>{`${dataVaultDetailLabels.filesLabel} (0)`}</span>
        <BreadcrumbGroup
          data-testid="file-breadcrumb"
          onClick={(event) => {
            event.preventDefault();
            setFilesTableState((state) => ({
              ...state,
              basePath: event.detail.href.replaceAll('#', '/'),
            }));
          }}
          items={breadcrumbItems}
          ariaLabel="Breadcrumbs"
        />
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
      onSelectionChange={({ detail }) => {
        setSelectedFiles(detail.selectedItems);
      }}
      selectedItems={selectedFiles}
      columnDefinitions={[
        {
          id: 'fileName',
          header: commonTableLabels.fileNameHeader,
          cell: fileFolderCell,
          width: 400,
          minWidth: 165,
          sortingField: 'fileName',
        },
        {
          id: 'contentType',
          header: commonTableLabels.fileTypeHeader,
          cell: (e) => e.contentType,
          width: 120,
          minWidth: 120,
          sortingField: 'contentType',
        },
        {
          id: 'fileSizeBytes',
          header: commonTableLabels.fileSizeHeader,
          cell: (e) => formatFileSize(e.fileSizeBytes),
          width: 100,
          minWidth: 100,
          sortingField: 'fileSizeBytes',
        },
        {
          id: 'updated',
          header: commonTableLabels.dateUploadedHeader,
          cell: (e) => formatDateFromISOString(e.updated?.toString()),
          width: 165,
          minWidth: 165,
          sortingField: 'updated',
        },
        {
          id: 'executionId',
          header: commonTableLabels.executionIdHeader,
          cell: (e) => e.executionId,
          width: 200,
          minWidth: 200,
          sortingField: 'executionId',
        },
        {
          id: 'caseAssociation',
          header: commonTableLabels.caseAssociationHeader,
          cell: statusCell,
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
