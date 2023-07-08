/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app/lib/models/case-file';
import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import { PropertyFilterProperty, useCollection } from '@cloudscape-design/collection-hooks';
import {
  Box,
  BreadcrumbGroup,
  Button,
  Header,
  Pagination,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { getPresignedUrl, restoreFile, useGetCaseActions, useListCaseFiles } from '../../api/cases';
import {
  caseStatusLabels,
  commonLabels,
  commonTableLabels,
  fileOperationsLabels,
  filesListLabels,
  paginationLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import { canDownloadFiles, canRestoreFiles, canUploadFiles } from '../../helpers/userActionSupport';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { ConfirmModal } from '../common-components/ConfirmModal';
import { CaseDetailsTabsProps } from './CaseDetailsTabs';

function CaseFilesTable(props: CaseDetailsTabsProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const userActions = useGetCaseActions(props.caseId);
  // Property and date filter collections
  const [filesTableState, setFilesTableState] = React.useState({
    textFilter: '',
    basePath: '/',
  });
  const { data, isLoading } = useListCaseFiles(props.caseId, filesTableState.basePath);
  const [selectedFiles, setSelectedFiles] = React.useState<DeaCaseFile[]>([]);
  const [downloadInProgress, setDownloadInProgress] = React.useState(false);

  const [filesToRestore, setFilesToRestore] = React.useState<DeaCaseFile[]>([]);
  const { pushNotification } = useNotifications();

  const filteringProperties: readonly PropertyFilterProperty[] = [
    {
      key: 'name',
      operators: ['=', '!=', ':', '!:'],
      propertyLabel: 'File Name',
      groupValuesLabel: 'File Name Values',
    },
  ];

  const { items, filterProps, collectionProps, paginationProps } = useCollection(data, {
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
      <Button
        data-testid={`${caseFile.fileName}-file-button`}
        iconName="file"
        variant="link"
        onClick={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          return router.push(`/file-detail?caseId=${caseFile.caseUlid}&fileId=${caseFile.ulid}`);
        }}
      >
        {caseFile.fileName}
      </Button>
    );
  };

  async function restoreFiles() {
    try {
      const restorePromises: Promise<void>[] = [];
      for (const file of filesToRestore) {
        restorePromises.push(restoreFile({ caseUlid: file.caseUlid, ulid: file.ulid }));
      }
      setFilesToRestore([]);
      await Promise.all(restorePromises);
      pushNotification('success', fileOperationsLabels.restoreSuccessful);
    } catch (e) {
      console.log('Failed to restore files', e);
      pushNotification('error', fileOperationsLabels.restoreFail);
    } finally {
      setFilesToRestore([]);
    }
  }

  function cancelRestore() {
    setFilesToRestore([]);
  }

  function tableActions() {
    if (props.caseStatus === CaseStatus.ACTIVE) {
      return (
        <SpaceBetween direction="horizontal" size="xs">
          <ConfirmModal
            testid="restore-modal"
            isOpen={
              canRestoreFiles(userActions?.data?.actions, availableEndpoints.data) &&
              filesToRestore.length !== 0
            }
            title={fileOperationsLabels.restoreFilesModalLabel(filesToRestore.length)}
            message={fileOperationsLabels.restoreFilesModalDescription}
            confirmAction={restoreFiles}
            confirmButtonText={commonLabels.restoreButton}
            cancelAction={cancelRestore}
            cancelButtonText={fileOperationsLabels.cancelRestoringLabel}
          />
          <Button
            data-testid="upload-file-button"
            onClick={uploadFilesHandler}
            disabled={!(canUploadFiles(userActions?.data?.actions) && props.caseStatus === CaseStatus.ACTIVE)}
          >
            {commonLabels.uploadButton}
          </Button>
          <Button
            data-testid="download-file-button"
            variant="primary"
            onClick={downloadFilesHandler}
            disabled={
              downloadInProgress ||
              !(canDownloadFiles(userActions?.data?.actions) && props.caseStatus === CaseStatus.ACTIVE)
            }
          >
            {commonLabels.downloadButton}
            {downloadInProgress ? <Spinner size="big" /> : null}
          </Button>
        </SpaceBetween>
      );
    }
  }

  // table header Element
  const tableHeader = (
    <Header variant="h2" description={filesListLabels.filterDescription} actions={tableActions()}>
      <SpaceBetween direction="horizontal" size="xs">
        <span>{`${filesListLabels.caseFilesLabel} (${props.fileCount})`}</span>
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
  const emptyConfig =
    props.caseStatus === CaseStatus.ACTIVE ? (
      <Box textAlign="center" color="inherit">
        <b>{filesListLabels.noFilesLabel}</b>
        <Box padding={{ bottom: 's' }} variant="p" color="inherit">
          {filesListLabels.noDisplayLabel}
        </Box>
        <Button onClick={uploadFilesHandler} disabled={!canUploadFiles(userActions?.data?.actions)}>
          {filesListLabels.uploadFileLabel}
        </Button>
      </Box>
    ) : (
      <Box textAlign="center" color="inherit">
        <b>{filesListLabels.noFilesLabel}</b>
        <Box padding={{ bottom: 's' }} variant="p" color="inherit">
          {filesListLabels.noDisplayLabel}
        </Box>
      </Box>
    );

  // pagination element
  const tablePagination = <Pagination {...paginationProps} ariaLabels={paginationLabels} />;

  function uploadFilesHandler() {
    return router.push(`/upload-files?caseId=${props.caseId}&filePath=${filesTableState.basePath}`);
  }

  async function downloadFilesHandler() {
    const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
    try {
      setDownloadInProgress(true);
      for (const file of selectedFiles) {
        try {
          const downloadResponse = await getPresignedUrl({ caseUlid: file.caseUlid, ulid: file.ulid });
          if (!downloadResponse.downloadUrl) {
            if (downloadResponse.isRestoring) {
              pushNotification('info', fileOperationsLabels.restoreInProgress(file.fileName));
            } else if (downloadResponse.isArchived) {
              if (canRestoreFiles(userActions?.data?.actions, availableEndpoints.data)) {
                filesToRestore.push(file);
              } else {
                pushNotification('error', fileOperationsLabels.archivedFileNoPermissionError(file.fileName));
              }
            }
            continue;
          }
          const alink = document.createElement('a');
          alink.href = downloadResponse.downloadUrl;
          alink.download = file.fileName;
          alink.click();
          // sleep 5ms => common problem when trying to quickly download files in succession => https://stackoverflow.com/a/54200538
          // long term we should consider zipping the files in the backend and then downloading as a single file
          await sleep(100);
        } catch (e) {
          pushNotification('error', fileOperationsLabels.downloadFailed(file.fileName));
          console.log(`failed to download ${file.fileName}`, e);
        }
      }
    } finally {
      setDownloadInProgress(false);
      setSelectedFiles([]);
    }
  }

  function getStatus(status: CaseFileStatus) {
    if (status == CaseFileStatus.ACTIVE) {
      return <StatusIndicator>{caseStatusLabels.active}</StatusIndicator>;
    } else {
      return <StatusIndicator type="stopped">{caseStatusLabels.inactive}</StatusIndicator>;
    }
  }

  return (
    <Table
      {...collectionProps}
      data-testid="file-table"
      selectionType={
        props.caseStatus === CaseStatus.ACTIVE && canDownloadFiles(userActions?.data?.actions)
          ? 'multi'
          : undefined
      }
      onSelectionChange={({ detail }) => {
        setSelectedFiles(detail.selectedItems);
      }}
      selectedItems={selectedFiles}
      isItemDisabled={(item) => item.status !== CaseFileStatus.ACTIVE || !item.isFile}
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.nameHeader,
          cell: fileFolderCell,
          width: 400,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'fileType',
          header: commonTableLabels.fileTypeHeader,
          cell: (e) => e.contentType,
          width: 170,
          minWidth: 170,
          sortingField: 'fileType',
        },
        {
          id: 'size',
          header: commonTableLabels.fileSizeHeader,
          cell: (e) => formatFileSize(e.fileSizeBytes),
          width: 100,
          minWidth: 100,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: commonTableLabels.dateUploadedHeader,
          cell: (e) => formatDateFromISOString(e.created?.toString()),
          width: 165,
          minWidth: 165,
          sortingField: 'uploadDate',
        },
        {
          id: 'uploader',
          header: commonTableLabels.uploadedByHeader,
          cell: (e) => e.createdBy,
          width: 150,
          minWidth: 150,
          sortingField: 'uploader',
        },
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: (e) => getStatus(e.status),
          width: 100,
          minWidth: 100,
          sortingField: 'status',
        },
      ]}
      items={items}
      loadingText={filesListLabels.loading}
      resizableColumns
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
