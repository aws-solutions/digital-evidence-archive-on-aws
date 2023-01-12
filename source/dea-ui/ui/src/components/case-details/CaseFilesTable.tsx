/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Table,
  Box,
  Button,
  TextFilter,
  Pagination,
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import * as React from 'react';

function CaseFilesTable(): JSX.Element {
  // Property and date filter collections
  const items = [
    {
      fileName: 'Dummy file 1',
      fileType: 'jpeg',
    },
    {
      fileName: 'Dummy file 2',
      fileType: 'doc',
    },
    {
      fileName: 'Dummy file 3',
      fileType: 'xml',
    },
  ];

  return (
    <Table
      columnDefinitions={[
        {
          id: 'name',
          header: 'Name',
          cell: (e) => e.fileName,
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'fileType',
          header: 'File type',
          cell: (e) => e.fileType,
          width: 170,
          minWidth: 165,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: 'Date uploaded',
          cell: () => 'FOO, 00/00/00',
          width: 170,
          minWidth: 165,
          sortingField: 'uploadDate',
        },
        {
          id: 'uploader',
          header: 'Uploaded by',
          cell: () => 'Sherlock Holmes',
          width: 170,
          minWidth: 165,
          sortingField: 'uploader',
        },
      ]}
      items={items}
      loadingText="loading files"
      resizableColumns
      selectionType="single"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No files</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No files to display.
          </Box>
          <Button>Upload a file</Button>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder="Search by file name" filteringText="" />}
      header={
        <Header
          variant="h2"
          description="All folders/files associated with this case."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button>Upload</Button>
              <Button variant="primary">Download</Button>
            </SpaceBetween>
          }
        >
          Case Files
        </Header>
      }
      pagination={
        <Pagination
          currentPageIndex={1}
          pagesCount={1}
          ariaLabels={{
            nextPageLabel: 'Next page',
            previousPageLabel: 'Previous page',
            pageLabel: (pageNumber) => `Page ${pageNumber} of all pages`,
          }}
        />
      }
    />
  );
}

export default CaseFilesTable;
