/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DownloadDTO } from '@aws/dea-app/lib/models/case-file';
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
  StatusIndicator,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { restoreFile, useGetCaseActions, useListCaseFiles } from '../../api/cases';
import {
  accessiblityLabels,
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
import { i18nStringsForPropertyFilter } from '../common-components/commonDefinitions';
import { ConfirmModal } from '../common-components/ConfirmModal';
import DownloadButton from '../common-components/DownloadButton';
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
  const [selectedFiles, setSelectedFiles] = React.useState<DownloadDTO[]>([]);
  const [downloadInProgress, setDownloadInProgress] = React.useState(false);

  const [filesToRestore, setFilesToRestore] = React.useState<DownloadDTO[]>([]);
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
    sorting: { defaultState: { isDescending: true, sortingColumn: { sortingField: 'created' } } },
    selection: {},
  });

  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
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

  const fileFolderCell = (caseFile: DownloadDTO) => {
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
          return router.push(
            `/file-detail?caseId=${caseFile.caseUlid}&fileId=${caseFile.ulid}&caseName=${props.caseName}`
          );
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
            cancelAction={() => {
              setFilesToRestore([]);
            }}
            cancelButtonText={commonLabels.cancelButton}
          />
          <Button
            data-testid="upload-file-button"
            onClick={uploadFilesHandler}
            disabled={!(canUploadFiles(userActions?.data?.actions) && props.caseStatus === CaseStatus.ACTIVE)}
          >
            {commonLabels.uploadButton}
          </Button>
          <DownloadButton
            caseId={props.caseId}
            caseStatus={props.caseStatus}
            selectedFiles={selectedFiles}
            selectedFilesCallback={setSelectedFiles}
            downloadInProgress={downloadInProgress}
            downloadInProgressCallback={setDownloadInProgress}
            filesToRestore={filesToRestore}
            filesToRestoreCallback={setFilesToRestore}
          />
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
    return router.push(
      `/upload-files?caseId=${props.caseId}&filePath=${filesTableState.basePath}&caseName=${props.caseName}`
    );
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
      ariaLabels={{
        selectionGroupLabel: accessiblityLabels.tableCheckboxSelectionGroupLabel,
        allItemsSelectionLabel: ({ selectedItems }) =>
          `${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'items'} selected`,
        itemSelectionLabel: (_, item) => item.fileName,
      }}
      isItemDisabled={(item) => item.status !== CaseFileStatus.ACTIVE || !item.isFile}
      columnDefinitions={[
        {
          id: 'fileName',
          header: commonTableLabels.nameHeader,
          cell: fileFolderCell,
          width: 400,
          minWidth: 165,
          sortingField: 'fileName',
        },
        {
          id: 'contentType',
          header: commonTableLabels.fileTypeHeader,
          cell: (e) => e.contentType,
          width: 170,
          minWidth: 170,
          sortingField: 'contentType',
        },
        {
          id: 'fileSizeBytes',
          header: commonTableLabels.fileSizeHeader,
          cell: (e) => formatFileSize(e.fileSizeBytes),
          width: 160,
          minWidth: 160,
          sortingField: 'fileSizeBytes',
        },
        {
          id: 'created',
          header: commonTableLabels.dateUploadedHeader,
          cell: (e) =>
            formatDateFromISOString(
              e.dataVaultUploadDate ? e.dataVaultUploadDate.toString() : e.created?.toString()
            ),
          width: 165,
          minWidth: 165,
          sortingField: 'created',
        },
        {
          id: 'createdBy',
          header: commonTableLabels.uploadedByHeader,
          cell: (e) => e.createdBy,
          width: 150,
          minWidth: 150,
          sortingField: 'createdBy',
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
          filteringClearAriaLabel={i18nStringsForPropertyFilter.clearAriaLabel}
          filteringPlaceholder={filesListLabels.searchLabel}
          filteringAriaLabel={filesListLabels.searchLabel}
        />
      }
      header={tableHeader}
      pagination={tablePagination}
    />
  );
}

export default CaseFilesTable;
