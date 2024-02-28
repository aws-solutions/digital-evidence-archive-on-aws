/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVaultFile } from '@aws/dea-app/lib/models/data-vault-file';
import { PropertyFilterProperty, useCollection } from '@cloudscape-design/collection-hooks';
import {
  Box,
  Button,
  Checkbox,
  ColumnLayout,
  Header,
  Icon,
  Link,
  Modal,
  Multiselect,
  Pagination,
  Popover,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  TextContent,
  TextFilter,
} from '@cloudscape-design/components';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useListAllCases } from '../../api/cases';
import { createDataVaultFileAssociation, useListDataVaultFiles } from '../../api/data-vaults';
import { ScopedDeaCaseDTO } from '../../api/models/case';
import {
  accessiblityLabels,
  breadcrumbLabels,
  commonLabels,
  commonTableLabels,
  dataVaultDetailLabels,
  filesListLabels,
  paginationLabels,
} from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import ActionContainer from '../common-components/ActionContainer';
import Breadcrumb, { BreadcrumbItem } from '../common-components/Breadcrumb';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStringsForPropertyFilter } from '../common-components/commonDefinitions';

export const CREATE_DATA_VAULT_CASE_ASSOCIATION_PATH = '/datavaults/{dataVaultId}/caseAssociationsPOST';

export interface DataVaultFilesTableProps {
  readonly dataVaultId: string;
  readonly availableEndpoints: string[];
  readonly dataVaultName: string;
}

function DataVaultFilesTable(props: DataVaultFilesTableProps): JSX.Element {
  const router = useRouter();
  const [displayFilesWithoutACase, setDisplayFilesWithoutACase] = useState(false);
  // Property and date filter collections
  const [filesTableState, setFilesTableState] = useState({
    textFilter: '',
    basePath: '/',
    label: 'Case files',
  });
  const { data, isLoading } = useListDataVaultFiles(props.dataVaultId, filesTableState.basePath);
  const [selectedFiles, setSelectedFiles] = useState<DeaDataVaultFile[]>([]);
  const [showAssociateToCaseModal, setShowAssociateToCaseModal] = useState(false);
  const [IsSubmitLoading, setIsSubmitLoading] = useState(false);
  const { pushNotification } = useNotifications();
  const [selectedCases, setSelectedCases] = useState<ReadonlyArray<OptionDefinition>>([]);
  const { data: allCases, isLoading: allCasesAreLoading } = useListAllCases();

  function fetchMultiselectOptions(data: ScopedDeaCaseDTO[], isLoading: boolean): OptionDefinition[] {
    if (isLoading) {
      return [];
    }
    return data.map(({ ulid, name }) => ({ value: ulid, label: name }));
  }
  const allOptions = useMemo(
    () => fetchMultiselectOptions(allCases, allCasesAreLoading),
    [allCases, allCasesAreLoading]
  );

  const filteringProperties: readonly PropertyFilterProperty[] = [
    {
      key: 'fileName',
      operators: ['=', '!=', ':', '!:'],
      propertyLabel: 'File Name',
      groupValuesLabel: 'File Name Values',
    },
  ];
  const { items, filterProps, collectionProps, paginationProps, actions } = useCollection(data, {
    filtering: {
      empty: TableEmptyDisplay(dataVaultDetailLabels.noFilesLabel, dataVaultDetailLabels.noFilesDisplayLabel),
      noMatch: TableNoMatchDisplay(dataVaultDetailLabels.noFilesLabel),
      filteringFunction: (item, filteringText) => {
        if (displayFilesWithoutACase && item.caseCount) {
          return false;
        }
        const filteringTextLowerCase = filteringText.toLowerCase();

        return item.fileName.toLowerCase().indexOf(filteringTextLowerCase) > -1;
      },
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
    sorting: { defaultState: { isDescending: true, sortingColumn: { sortingField: 'updated' } } },
    selection: {},
  });

  if (isLoading) {
    return <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>;
  }

  const pathParts = filesTableState.basePath.split('/');
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: breadcrumbLabels.rootLabel, value: '#', iconName: 'folder' },
  ];

  let hrefString = '#';
  pathParts.forEach((part) => {
    if (part !== '') {
      hrefString += part + '#';
      breadcrumbItems.push({ label: part, value: hrefString, iconName: 'folder' });
    }
  });

  async function associateToCaseHandler() {
    setIsSubmitLoading(true);
    try {
      await createDataVaultFileAssociation(props.dataVaultId, {
        caseUlids: selectedCases.map((option) => option.value ?? ''),
        fileUlids: selectedFiles.map((file) => file.ulid),
      });
      pushNotification('success', dataVaultDetailLabels.associateToCaseSuccessNotificationMessage);
      setSelectedFiles([]);
      setSelectedCases([]);
    } catch (e) {
      if (e instanceof Error) {
        pushNotification('error', e.message);
      }
    } finally {
      setIsSubmitLoading(false);
      disableAssociateToCaseModal();
    }
  }

  function enableAssociateToCaseModal() {
    setShowAssociateToCaseModal(true);
  }

  function disableAssociateToCaseModal() {
    setShowAssociateToCaseModal(false);
  }

  function associateToCaseModal() {
    return (
      <Modal
        data-testid="associate-to-case-modal"
        onDismiss={disableAssociateToCaseModal}
        visible={showAssociateToCaseModal && selectedFiles.length !== 0}
        closeAriaLabel={commonLabels.closeModalAriaLabel}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                data-testid="cancel-case-association"
                variant="link"
                onClick={disableAssociateToCaseModal}
              >
                {commonLabels.cancelButton}
              </Button>
              <Button
                data-testid="submit-case-association"
                variant="primary"
                onClick={associateToCaseHandler}
                disabled={IsSubmitLoading || selectedCases.length === 0}
              >
                {IsSubmitLoading ? <Spinner variant="disabled" /> : null}
                {commonLabels.confirmButton}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={dataVaultDetailLabels.associateToCaseModalTitle}
      >
        <TextContent>
          <span>
            <strong>{dataVaultDetailLabels.associateToCaseDescription}</strong>
          </span>
        </TextContent>
        <Box padding={{ bottom: 'xxl' }}>
          <Multiselect
            selectedOptions={selectedCases}
            onChange={({ detail }) => setSelectedCases(detail.selectedOptions)}
            options={allOptions}
            filteringType="auto"
            keepOpen={false}
            placeholder={dataVaultDetailLabels.associateToCaseMultiselectPlaceholder}
            filteringPlaceholder={dataVaultDetailLabels.associateToCaseMultiselectFilteringPlaceholder}
            ariaLabel={dataVaultDetailLabels.associateToCaseMultiselectPlaceholder}
            filteringAriaLabel={dataVaultDetailLabels.associateToCaseMultiselectFilteringPlaceholder}
            filteringClearAriaLabel={i18nStringsForPropertyFilter.clearAriaLabel}
            selectedAriaLabel={commonLabels.selectedLabel}
            ariaDescribedby={allOptions.map((option) => option.label).join(' ')}
          />
        </Box>
      </Modal>
    );
  }

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
            label: dataVaultFile.fileName,
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
            `/data-vault-file-detail?dataVaultId=${dataVaultFile.dataVaultUlid}&fileId=${dataVaultFile.ulid}&dataVaultName=${props.dataVaultName}`
          );
        }}
      >
        {dataVaultFile.fileName}
      </Button>
    );
  };

  function statusCell(dataVaultFile: DeaDataVaultFile) {
    if (!dataVaultFile.isFile) {
      return '-';
    }
    if (dataVaultFile.caseCount) {
      return <StatusIndicator>{dataVaultDetailLabels.associatedLabel}</StatusIndicator>;
    }
    return <StatusIndicator type="stopped">{dataVaultDetailLabels.noAssociatedLabel}</StatusIndicator>;
  }

  function tableActions() {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        {associateToCaseModal()}
        <ActionContainer
          required={CREATE_DATA_VAULT_CASE_ASSOCIATION_PATH}
          actions={props.availableEndpoints}
        >
          <Button
            disabled={selectedFiles.length === 0}
            data-testid="data-vault-associate-button"
            variant="primary"
            onClick={enableAssociateToCaseModal}
          >
            {commonTableLabels.associateButtonLabel}
          </Button>
        </ActionContainer>
      </SpaceBetween>
    );
  }

  function tableHeaderDescription(): React.ReactNode {
    return (
      <>
        {dataVaultDetailLabels.filesTableHeaderDescription}{' '}
        <Link
          external
          externalIconAriaLabel={accessiblityLabels.implementationGuideLinkLabel}
          ariaLabel={accessiblityLabels.implementationGuideLinkLabel}
          href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
        >
          {commonTableLabels.implementationGuideLabel}
        </Link>
        <br />
        {dataVaultDetailLabels.filesDatasyncSignInLabel}
        <Popover
          size="small"
          position="top"
          triggerType="custom"
          dismissButton={false}
          content={<StatusIndicator type="success">{commonLabels.linkCopiedLabel}</StatusIndicator>}
        >
          <Button
            iconName="copy"
            variant="inline-icon"
            data-testid="copy-datasync-link-button"
            onClick={() => {
              void navigator.clipboard.writeText('https://aws.amazon.com/datasync/');
            }}
          />
          {commonLabels.copyLinkLabel}
        </Popover>
      </>
    );
  }

  // table header Element
  const tableHeader = (
    <Header variant="h2" description={tableHeaderDescription()} actions={tableActions()}>
      <span>{`${dataVaultDetailLabels.filesLabel} (${items.length})`}</span>
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
        {commonTableLabels.implementationGuideLabel}
        <span role="img" aria-label={accessiblityLabels.implementationGuideLinkLabel}>
          <Icon name="external" variant="inverted" />
        </span>
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
      ariaLabels={{
        selectionGroupLabel: accessiblityLabels.tableCheckboxSelectionGroupLabel,
        allItemsSelectionLabel: ({ selectedItems }) =>
          `${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'items'} selected`,
        itemSelectionLabel: (_, item) => item.fileName,
      }}
      columnDefinitions={[
        {
          id: 'fileName',
          header: commonTableLabels.nameHeader,
          cell: fileFolderCell,
          width: 350,
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
          width: 120,
          minWidth: 120,
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
        <SpaceBetween direction="vertical" size="m">
          <ColumnLayout columns={2}>
            <TextFilter
              data-testid="files-text-filter"
              {...filterProps}
              filteringClearAriaLabel={i18nStringsForPropertyFilter.clearAriaLabel}
              filteringAriaLabel={filesListLabels.searchLabel}
              filteringPlaceholder={filesListLabels.searchLabel}
            />
            <Box padding="xxs">
              <Checkbox
                onChange={({ detail }) => setDisplayFilesWithoutACase(detail.checked)}
                checked={displayFilesWithoutACase}
                ariaLabel={dataVaultDetailLabels.displayFilesCheckboxLabel}
              >
                {dataVaultDetailLabels.displayFilesCheckboxLabel}
              </Checkbox>
            </Box>
          </ColumnLayout>
          <Breadcrumb
            data-testid="files-breadcrumb"
            breadcrumbItems={breadcrumbItems}
            filesTableState={filesTableState}
            onClick={(event) => {
              event.preventDefault();
              actions.setFiltering('');
              setFilesTableState((state) => ({
                ...state,
                label: event.detail.selectedOption
                  ? event.detail.selectedOption.label
                  : event.detail.href.replaceAll('#', '/'),
                basePath: event.detail.selectedOption
                  ? event.detail.selectedOption.value.replaceAll('#', '/')
                  : event.detail.href.replaceAll('#', '/'),
              }));
            }}
          />
        </SpaceBetween>
      }
      header={tableHeader}
      pagination={tablePagination}
    />
  );
}

export default DataVaultFilesTable;
