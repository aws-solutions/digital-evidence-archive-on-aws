/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import {
  Box,
  BreadcrumbGroup,
  Button,
  Header,
  Icon,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import * as React from 'react';
import { useListCaseFiles } from '../../api/cases';
import { commonLabels, commonTableLabels, filesListLabels } from '../../common/labels';
import { CaseDetailsBodyProps } from './CaseDetailsBody';

function CaseFilesTable(props: CaseDetailsBodyProps): JSX.Element {
  // Property and date filter collections
  const [basePath, setBasePath] = React.useState('/');
  const { data, isLoading } = useListCaseFiles(props.caseId, basePath);

  if (isLoading) {
    return <h1>{commonLabels.loadingLabel}</h1>;
  }

  const pathParts = basePath.split('/');
  const breadcrumbItems = [{ text: '/', href: '#' }];

  let hrefString = '#';
  pathParts.forEach((part) => {
    if (part !== '') {
      hrefString += part + '#';
      breadcrumbItems.push({ text: part, href: hrefString });
    }
  });

  const fileFolderCell = (caseFile: DeaCaseFile) => {
    return !caseFile.isFile ? (
      <Button
        data-testid={`${caseFile.fileName}-button`}
        iconName="folder"
        variant="link"
        onClick={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          setBasePath(basePath + caseFile.fileName + '/');
        }}
      >
        {caseFile.fileName}
      </Button>
    ) : (
      <Box padding={{ left: 'm' }} data-testid={`${caseFile.fileName}-box`}>
        <SpaceBetween direction="horizontal" size="xs" key={caseFile.fileName}>
          <Icon name="file" />
          {caseFile.fileName}
        </SpaceBetween>
      </Box>
    );
  };

  // table header Element
  const tableHeader = (
    <Header
      variant="h2"
      description={filesListLabels.filterDescription}
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button>{commonLabels.uploadButton}</Button>
          <Button variant="primary">{commonLabels.downloadButton}</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween direction="horizontal" size="xs">
        {filesListLabels.caseFilesLabel}
        <BreadcrumbGroup
          data-testid="file-breadcrumb"
          onClick={(event) => {
            event.preventDefault();
            setBasePath(event.detail.href.replaceAll('#', '/'));
          }}
          items={breadcrumbItems}
          ariaLabel="Breadcrumbs"
        />
      </SpaceBetween>
    </Header>
  );

  // empty table Element
  const emptyConfig = (
    <Box textAlign="center" color="inherit">
      <b>{filesListLabels.noFilesLabel}</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        {filesListLabels.noDisplayLabel}
      </Box>
      <Button>{filesListLabels.uploadFileLabel}</Button>
    </Box>
  );

  // pagination element
  const tablePagination = (
    <Pagination
      currentPageIndex={1}
      pagesCount={1}
      ariaLabels={{
        nextPageLabel: 'Next page',
        previousPageLabel: 'Previous page',
        pageLabel: (pageNumber) => `Page ${pageNumber} of all pages`,
      }}
    />
  );

  return (
    <Table
      data-testid="file-table"
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.nameHeader,
          cell: fileFolderCell,
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'fileType',
          header: commonTableLabels.fileTypeHeader,
          cell: (e) => e.contentType,
          width: 170,
          minWidth: 165,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: commonTableLabels.dateUploadedHeader,
          cell: (e) => e.created,
          width: 170,
          minWidth: 165,
          sortingField: 'uploadDate',
        },
        {
          id: 'uploader',
          header: commonTableLabels.uploadedByHeader,
          cell: (e) => e.createdBy,
          width: 170,
          minWidth: 165,
          sortingField: 'uploader',
        },
      ]}
      items={data}
      loadingText={filesListLabels.loading}
      resizableColumns
      selectionType="multi"
      empty={emptyConfig}
      filter={<TextFilter filteringPlaceholder={filesListLabels.searchLabel} filteringText="" />}
      header={tableHeader}
      pagination={tablePagination}
    />
  );
}

export default CaseFilesTable;
