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
  Icon,
  Pagination,
  SpaceBetween,
  Spinner,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import {
  getCaseFileAuditCSV,
  getPresignedUrl,
  restoreFile,
  useGetCaseActions,
  useListCaseFiles,
} from '../../api/cases';
import {
  auditLogLabels,
  commonLabels,
  commonTableLabels,
  fileOperationsLabels,
  filesListLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDate } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import {
  canDownloadCaseAudit,
  canDownloadFiles,
  canRestoreFiles,
  canUploadFiles,
} from '../../helpers/userActionSupport';
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
  const [caseFileAuditDownloadInProgress, setCaseFileAuditDownloadInProgress] = React.useState(false);
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

  const { items, filterProps, collectionProps } = useCollection(data, {
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
          <span>{caseFile.fileName}</span>
        </SpaceBetween>
      </Box>
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
      pushNotification('success', 'Successfully restored selected files');
    } catch (e) {
      console.log('Failed to restore files', e);
      pushNotification('error', 'Failed to restore selected files');
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
            cancelButtonText={commonLabels.cancelButton}
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
          <Button
            data-testid="download-case-file-audit-button"
            variant="primary"
            onClick={downloadCaseFileAuditHandler}
            disabled={caseFileAuditDownloadInProgress || !canDownloadCaseAudit(userActions.data?.actions)}
          >
            {auditLogLabels.caseFileAuditLogLabel}
            {caseFileAuditDownloadInProgress ? <Spinner size="big" /> : null}
          </Button>
        </SpaceBetween>
      );
    }
  }

  // table header Element
  const tableHeader = (
    <Header variant="h2" description={filesListLabels.filterDescription} actions={tableActions()}>
      <SpaceBetween direction="horizontal" size="xs">
        <span>{filesListLabels.caseFilesLabel}</span>
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

  async function downloadCaseFileAuditHandler() {
    const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
    try {
      setCaseFileAuditDownloadInProgress(true);
      for (const file of selectedFiles) {
        try {
          if (!file.ulid) {
            pushNotification('error', `Failed to download case file audit for ${file.fileName}`);
            console.log(`failed to download case file audit for ${file.fileName}`);
            continue;
          }
          const csv = await getCaseFileAuditCSV(file.caseUlid, file.ulid);
          const blob = new Blob([csv], { type: 'text/csv' });
          const fileUrl = window.URL.createObjectURL(blob);
          const alink = document.createElement('a');
          alink.href = fileUrl;
          alink.download = `${file.fileName}_Audit_${new Date().toLocaleString()}`;
          alink.click();

          // sleep 2ms => common problem when trying to quickly download files in succession => https://stackoverflow.com/a/54200538
          // long term we should consider zipping the files in the backend and then downloading as a single file
          await sleep(2);
        } catch (e) {
          pushNotification('error', `Failed to download case file audit for ${file.fileName}`);
          console.log(`failed to download case file audit for ${file.fileName}`, e);
        }
      }
    } finally {
      setCaseFileAuditDownloadInProgress(false);
      setSelectedFiles([]);
    }
  }

  function uploadFilesHandler() {
    void router.push(`/upload-files?caseId=${props.caseId}&filePath=${filesTableState.basePath}`);
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
              pushNotification(
                'info',
                `${file.fileName} is currently being restored. It will be ready to download in up to 12 hours`
              );
            } else if (downloadResponse.isArchived) {
              if (canRestoreFiles(userActions?.data?.actions, availableEndpoints.data)) {
                filesToRestore.push(file);
              } else {
                pushNotification(
                  'error',
                  `${file.fileName} is archived. Please contact case owner to restore file for access.`
                );
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
          await sleep(5);
        } catch (e) {
          pushNotification('error', `Failed to download ${file.fileName}`);
          console.log(`failed to download ${file.fileName}`, e);
        }
      }
    } finally {
      setDownloadInProgress(false);
      setSelectedFiles([]);
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
      isItemDisabled={(item) => item.status !== CaseFileStatus.ACTIVE}
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
          id: 'size',
          header: commonTableLabels.fileSizeHeader,
          cell: (e) => formatFileSize(e.fileSizeBytes),
          width: 170,
          minWidth: 165,
          sortingField: 'fileType',
        },
        {
          id: 'uploadDate',
          header: commonTableLabels.dateUploadedHeader,
          cell: (e) => formatDate(e.created),
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
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: (e) => e.status,
          width: 170,
          minWidth: 165,
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
