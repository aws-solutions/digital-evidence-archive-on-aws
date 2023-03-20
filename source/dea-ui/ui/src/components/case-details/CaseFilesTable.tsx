/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import { PropertyFilterProperty, useCollection } from '@cloudscape-design/collection-hooks';
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
  Spinner,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { getPresignedUrl, useListCaseFiles } from '../../api/cases';
import { commonLabels, commonTableLabels, filesListLabels } from '../../common/labels';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { CaseDetailsBodyProps } from './CaseDetailsBody';

function CaseFilesTable(props: CaseDetailsBodyProps): JSX.Element {
  const router = useRouter();
  // Property and date filter collections
  const [filesTableState, setFilesTableState] = React.useState({
    textFilter: '',
    basePath: '/',
  });
  const { data, isLoading } = useListCaseFiles(props.caseId, filesTableState.basePath);
  const [selectedFiles, setSelectedFiles] = React.useState<DeaCaseFile[]>([]);
  const [downloadInProgress, setDownloadInProgress] = React.useState(false);

  const filteringProperties: readonly PropertyFilterProperty[] = [
    {
      key: 'name',
      operators: ['=', '!=', ':', '!:'],
      propertyLabel: 'File Name',
      groupValuesLabel: 'File Name Values',
    },
  ];

  const { items, filterProps } = useCollection(data, {
    filtering: {
      empty: TableEmptyDisplay(filesListLabels.noFilesLabel, filesListLabels.noDisplayLabel),
      noMatch: TableNoMatchDisplay(filesListLabels.noFilesLabel),
      filteringFunction: (item, filteringText) => {
        const filenameLowerCase: string = item.fileName.toLowerCase();
        const filteringTextLowerCase = filteringText.toLowerCase();

        return filenameLowerCase.includes(filteringTextLowerCase);
      },
    },
    propertyFiltering: {
      filteringProperties: filteringProperties,
      empty: TableEmptyDisplay(filesListLabels.noFilesLabel, filesListLabels.noDisplayLabel),
      noMatch: TableNoMatchDisplay(filesListLabels.noFilesLabel),
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

  const fileFolderCell = (caseFile: DeaCaseFile) => {
    return !caseFile.isFile ? (
      <Button
        data-testid={`${caseFile.fileName}-button`}
        iconName="folder"
        variant="link"
        onClick={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          setFilesTableState((state) => ({
            ...state,
            basePath: filesTableState.basePath + caseFile.fileName + '/',
          }));
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
          <Button data-testid="upload-file-button" onClick={uploadFilesHandler}>
            {commonLabels.uploadButton}
          </Button>
          <Button
            data-testid="download-file-button"
            variant="primary"
            onClick={downloadFilesHandler}
            disabled={downloadInProgress}
          >
            {commonLabels.downloadButton}
            {downloadInProgress ? <Spinner size="big" /> : null}
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween direction="horizontal" size="xs">
        {filesListLabels.caseFilesLabel}
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
  const emptyConfig = (
    <Box textAlign="center" color="inherit">
      <b>{filesListLabels.noFilesLabel}</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        {filesListLabels.noDisplayLabel}
      </Box>
      <Button onClick={uploadFilesHandler}>{filesListLabels.uploadFileLabel}</Button>
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

  function uploadFilesHandler() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push(`/upload-files?caseId=${props.caseId}&filePath=${filesTableState.basePath}`);
  }

  async function downloadFilesHandler() {
    try {
      for (const file of selectedFiles) {
        setDownloadInProgress(true);
        const downloadResponse = await getPresignedUrl({ caseUlid: file.caseUlid, ulid: file.ulid });
        //TODO: need to figure out hash validation on download
        fetch(downloadResponse.downloadUrl, { method: 'GET' })
          .then((response) => {
            response
              .blob()
              .then((blob) => {
                const fileUrl = window.URL.createObjectURL(blob);
                const alink = document.createElement('a');
                alink.href = fileUrl;
                alink.download = file.fileName;
                alink.click();
              })
              .catch((reason) => {
                // TODO add error banner like in figma
                console.log(reason);
              });
          })
          .catch((reason) => {
            // TODO add error banner like in figma
            console.log(reason);
          });
      }
    } finally {
      setDownloadInProgress(false);
      setSelectedFiles([]);
    }
  }

  return (
    <Table
      data-testid="file-table"
      onSelectionChange={({ detail }) => {
        setSelectedFiles(detail.selectedItems);
      }}
      selectedItems={selectedFiles}
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
      items={items}
      loadingText={filesListLabels.loading}
      resizableColumns
      selectionType="multi"
      empty={emptyConfig}
      filter={
        <TextFilter
          data-testid="files-text-filter"
          {...filterProps}
          filteringPlaceholder={filesListLabels.searchLabel}
        />
      }
      header={tableHeader}
      pagination={tablePagination}
    />
  );
}

export default CaseFilesTable;
