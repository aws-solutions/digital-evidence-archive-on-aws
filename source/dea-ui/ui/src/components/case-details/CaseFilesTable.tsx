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
import { useRouter } from 'next/router';
import * as React from 'react';
import { commonTableLabels, filesListLabels, commonLabels, caseListLabels } from '../../common/labels';

interface CaseFilesTableProps {
  readonly caseId: string;
}

function CaseFilesTable(props: CaseFilesTableProps): JSX.Element {
  const router = useRouter();

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

  function uploadFileHandler() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push(`/cases/${props.caseId}/upload-file`);
  }

  return (
    <Table
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.nameHeader,
          cell: (e) => e.fileName,
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'fileType',
          header: commonTableLabels.fileTypeHeader,
          cell: (e) => e.fileType,
          width: 170,
          minWidth: 165,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: commonTableLabels.dateUploadedHeader,
          cell: () => 'FOO, 00/00/00',
          width: 170,
          minWidth: 165,
          sortingField: 'uploadDate',
        },
        {
          id: 'uploader',
          header: commonTableLabels.uploadedByHeader,
          cell: () => 'Sherlock Holmes',
          width: 170,
          minWidth: 165,
          sortingField: 'uploader',
        },
      ]}
      items={items}
      loadingText={filesListLabels.loading}
      resizableColumns
      selectionType="single"
      empty={
        <Box textAlign="center" color="inherit">
          <b>{filesListLabels.noFilesLabel}</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            {filesListLabels.noDisplayLabel}
          </Box>
          <Button>{filesListLabels.uploadFileLabel}</Button>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder={filesListLabels.searchLabel} filteringText="" />}
      header={
        <Header
          variant="h2"
          description={filesListLabels.filterDescription}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button data-testid="upload-file-button" onClick={uploadFileHandler}>
                {commonLabels.uploadButton}
              </Button>
              <Button variant="primary">{commonLabels.downloadButton}</Button>
            </SpaceBetween>
          }
        >
          {filesListLabels.caseFilesLabel}
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
