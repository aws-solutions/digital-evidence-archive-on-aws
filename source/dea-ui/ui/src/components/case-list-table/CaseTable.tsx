/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileStatus } from '@aws/dea-app/lib/models/case-file-status';
import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  Link,
  Pagination,
  PropertyFilter,
  SpaceBetween,
  Table,
  Toggle,
} from '@cloudscape-design/components';
import Box from '@cloudscape-design/components/box';
import Modal from '@cloudscape-design/components/modal';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { DeaListResult, updateCaseStatus } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { caseListLabels, commonLabels, commonTableLabels } from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { canCreateCases, canUpdateCaseStatus } from '../../helpers/userActionSupport';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { ConfirmModal } from '../common-components/ConfirmModal';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './caseListDefinitions';

export type CaseFetcherSignature = () => DeaListResult<DeaCaseDTO>;
export interface CaseTableProps {
  useCaseFetcher: CaseFetcherSignature;
  canCreate: boolean;
  canUpdateStatus: boolean;
  detailPage: string;
  headerLabel: string;
}

function CaseTable(props: CaseTableProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data, isLoading } = props.useCaseFetcher();
  const [selectedCase, setSelectedCase] = React.useState<DeaCaseDTO[]>([]);
  const [showActivateModal, setShowActivateModal] = React.useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = React.useState(false);
  const [deleteFiles, setDeleteFiles] = React.useState(false);

  // Property and date filter collections
  const { items, filteredItemsCount, propertyFilterProps, collectionProps } = useCollection(data, {
    filtering: {
      empty: TableEmptyDisplay(caseListLabels.noCasesLabel, caseListLabels.noDisplayLabel),
      noMatch: TableNoMatchDisplay(caseListLabels.noCasesMatchLabel),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filteringFunction: (item: any, filteringText): any => {
        const filteringTextLowerCase = filteringText.toLowerCase();

        return (
          searchableColumns
            // eslint-disable-next-line security/detect-object-injection
            .map((key) => item[key])
            .some(
              (value) => typeof value === 'string' && value.toLowerCase().indexOf(filteringTextLowerCase) > -1
            )
        );
      },
    },
    propertyFiltering: {
      filteringProperties: filteringProperties,
      empty: TableEmptyDisplay(caseListLabels.noCasesLabel, caseListLabels.noDisplayLabel),
      noMatch: TableNoMatchDisplay(caseListLabels.noCasesMatchLabel),
    },
    sorting: {},
    selection: {},
  });
  function createNewCaseHandler() {
    void router.push('/create-cases');
  }

  function canActivateCase(): boolean {
    return (
      canUpdateCaseStatus(availableEndpoints.data) &&
      selectedCase.length === 1 &&
      selectedCase[0].status === CaseStatus.INACTIVE
    );
  }

  async function activateCaseHandler() {
    if (selectedCase.length === 0) {
      console.error('No cases selected for activate');
    }
    const deaCase = selectedCase[0];
    await updateCaseStatus({
      name: deaCase.name,
      caseId: deaCase.ulid,
      status: CaseStatus.ACTIVE,
      deleteFiles: false,
    });
    disableActivateCaseModal();
  }

  function canDeactivateCase(): boolean {
    return (
      canUpdateCaseStatus(availableEndpoints.data) &&
      selectedCase.length === 1 &&
      (selectedCase[0].status === CaseStatus.ACTIVE ||
        selectedCase[0].filesStatus === CaseFileStatus.DELETE_FAILED)
    );
  }
  async function deactivateCaseHandler() {
    if (selectedCase.length === 0) {
      console.error('No cases selected for deactivate');
    }
    const deaCase = selectedCase[0];
    await updateCaseStatus({
      name: deaCase.name,
      caseId: deaCase.ulid,
      status: CaseStatus.INACTIVE,
      deleteFiles,
    });
    disableDeactivateCaseModal();
  }

  function enableDeactivateCaseModal() {
    setShowDeactivateModal(true);
  }

  function disableDeactivateCaseModal() {
    setShowDeactivateModal(false);
  }

  function enableActivateCaseModal() {
    setShowActivateModal(true);
  }

  function disableActivateCaseModal() {
    setShowActivateModal(false);
  }

  return (
    <Table
      {...collectionProps}
      data-testid="case-table"
      onSelectionChange={({ detail }) => setSelectedCase(detail.selectedItems)}
      selectedItems={selectedCase}
      selectionType="single"
      trackBy="ulid"
      loading={isLoading}
      variant="full-page"
      items={items}
      loadingText={caseListLabels.loading}
      resizableColumns={true}
      empty={TableEmptyDisplay(caseListLabels.noCasesLabel, caseListLabels.noDisplayLabel)}
      header={
        <TableHeader
          data-testid="case-table-header"
          variant="awsui-h1-sticky"
          title={props.headerLabel}
          description={caseListLabels.casesPageDescription}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              <Modal
                onDismiss={disableDeactivateCaseModal}
                visible={showDeactivateModal && selectedCase.length !== 0}
                closeAriaLabel={commonLabels.closeModalAriaLabel}
                footer={
                  <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button variant="link" onClick={disableDeactivateCaseModal}>
                        {commonLabels.cancelButton}
                      </Button>
                      <Button variant="primary" onClick={deactivateCaseHandler}>
                        {commonLabels.deactivateButton}
                      </Button>
                    </SpaceBetween>
                  </Box>
                }
                header={
                  selectedCase.length === 0
                    ? 'No cases selected'
                    : caseListLabels.deactivateCaseModalLabel(selectedCase[0].name)
                }
              >
                {caseListLabels.deactivateCaseModalMessage}
                <Toggle onChange={({ detail }) => setDeleteFiles(detail.checked)} checked={deleteFiles}>
                  {caseListLabels.deleteFilesLabel}
                </Toggle>
              </Modal>
              {props.canUpdateStatus && (
                <Button disabled={!canDeactivateCase()} variant="primary" onClick={enableDeactivateCaseModal}>
                  {caseListLabels.deactivateCaseLabel}
                </Button>
              )}
              <ConfirmModal
                isOpen={showActivateModal && selectedCase.length !== 0}
                title={
                  selectedCase.length === 0
                    ? 'unselected'
                    : caseListLabels.activateCaseModalLabel(selectedCase[0].name)
                }
                message={caseListLabels.activateCaseModalMessage}
                confirmAction={activateCaseHandler}
                confirmButtonText={commonLabels.activateButton}
                cancelAction={disableActivateCaseModal}
                cancelButtonText={commonLabels.cancelButton}
              />
              {props.canUpdateStatus && (
                <Button disabled={!canActivateCase()} variant="primary" onClick={enableActivateCaseModal}>
                  {caseListLabels.activateCaseLabel}
                </Button>
              )}
              {props.canCreate && (
                <Button
                  disabled={!canCreateCases(availableEndpoints.data)}
                  data-testid="create-case-button"
                  variant="primary"
                  onClick={createNewCaseHandler}
                >
                  {caseListLabels.createNewCaseLabel}
                </Button>
              )}
            </SpaceBetween>
          }
          totalItems={data}
        />
      }
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.caseNameHeader,
          cell: (e) => (
            <Link
              href={`${e.ulid}`}
              onFollow={(e) => {
                e.preventDefault();
                void router.push(`/${props.detailPage}?caseId=${e.detail.href}`);
              }}
            >
              {e.name}
            </Link>
          ),
          width: 350,
          minWidth: 220,
          sortingField: 'name',
        },
        {
          id: 'objectCount',
          header: commonTableLabels.objectCounterHeader,
          cell: (e) => e.objectCount,
          width: 220,
          minWidth: 165,
          sortingField: 'objectCount',
        },
        {
          id: 'created',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => formatDateFromISOString(e.created),
          width: 200,
          minWidth: 165,
          sortingField: 'created',
        },
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: (e) => e.status,
          width: 200,
          minWidth: 165,
          sortingField: 'status',
        },
      ]}
      filter={
        <SpaceBetween direction="vertical" size="xs">
          <PropertyFilter
            {...propertyFilterProps}
            countText={getFilterCounterText(filteredItemsCount)}
            i18nStrings={i18nStrings}
            filteringOptions={filteringOptions}
            expandToViewport={true}
          />
        </SpaceBetween>
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

const getFilterCounterText = (count: number | undefined): string =>
  `${count} ${count === 1 ? 'match' : 'matches'}`;
export default CaseTable;
