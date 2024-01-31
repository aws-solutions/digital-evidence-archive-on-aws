/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Box,
  Button,
  ColumnLayout,
  Link,
  Modal,
  Pagination,
  PropertyFilter,
  SpaceBetween,
  Table,
  TextContent,
} from '@cloudscape-design/components';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useAvailableEndpoints } from '../../api/auth';
import { DeaListResult } from '../../api/models/api-results';
import {
  accessiblityLabels,
  commonLabels,
  commonTableLabels,
  dataVaultListLabels,
  paginationLabels,
} from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { formatFileSize } from '../../helpers/fileHelper';
import ActionContainer from '../common-components/ActionContainer';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './dataVaultListDefinitions';
import stepOneImage from './svgs/1_enable-security.svg';
import stepTwoImage from './svgs/2_car.svg';
import stepThreeImage from './svgs/3_docs.svg';
import stepFourImage from './svgs/4_computer.svg';

export const CREATE_DATA_VAULT_PATH = '/datavaultsPOST';

export type DataVaultFetcherSignature = () => DeaListResult<DeaDataVault>;
export interface DataVaultsTableProps {
  useDataVaultFetcher: DataVaultFetcherSignature;
  detailPage: string;
  headerLabel: string;
  headerDescription: string;
}

function DataVaultsTable(props: DataVaultsTableProps): JSX.Element {
  const router = useRouter();
  const availableEndpoints = useAvailableEndpoints();
  const { data, isLoading } = props.useDataVaultFetcher();
  const [showHowItWorksModal, setHowItWorksModal] = useState(false);

  // Property and date filter collections
  const { items, filteredItemsCount, propertyFilterProps, collectionProps, paginationProps } = useCollection(
    data,
    {
      filtering: {
        empty: TableEmptyDisplay(dataVaultListLabels.noDataVaultsLabel, dataVaultListLabels.noDisplayLabel),
        noMatch: TableNoMatchDisplay(dataVaultListLabels.noDataVaultsMatchLabel),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteringFunction: (item: any, filteringText): any => {
          const filteringTextLowerCase = filteringText.toLowerCase();

          return (
            searchableColumns
              // eslint-disable-next-line security/detect-object-injection
              .map((key) => item[key])
              .some(
                (value) =>
                  typeof value === 'string' && value.toLowerCase().indexOf(filteringTextLowerCase) > -1
              )
          );
        },
      },
      propertyFiltering: {
        filteringProperties: filteringProperties,
        empty: TableEmptyDisplay(dataVaultListLabels.noDataVaultsLabel, dataVaultListLabels.noDisplayLabel),
        noMatch: TableNoMatchDisplay(dataVaultListLabels.noDataVaultsMatchLabel),
      },
      sorting: { defaultState: { isDescending: true, sortingColumn: { sortingField: 'created' } } },
      selection: {},
      pagination: {
        pageSize: 15,
      },
    }
  );

  function enableHowItWorksModal() {
    setHowItWorksModal(true);
  }

  function disableHowItWorksModal() {
    setHowItWorksModal(false);
  }

  function howItWorksModal() {
    return (
      <Modal
        data-testid="how-it-works-modal"
        size="large"
        onDismiss={disableHowItWorksModal}
        visible={showHowItWorksModal}
        closeAriaLabel={commonLabels.closeModalAriaLabel}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button data-testid="submit-close" variant="primary" onClick={disableHowItWorksModal}>
                {commonLabels.closeButton}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <TextContent>
            <h2>{dataVaultListLabels.howItWorksTitle}</h2>
            {dataVaultListLabels.howItWorksDescription}{' '}
            <Link
              external
              externalIconAriaLabel={accessiblityLabels.implementationGuideLinkLabel}
              ariaLabel={accessiblityLabels.implementationGuideLinkLabel}
              href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
            >
              {commonTableLabels.implementationGuideLabel}
            </Link>
          </TextContent>
        }
      >
        <ColumnLayout columns={4}>
          <Image src={stepOneImage} alt={dataVaultListLabels.howItWorksStepOneImageLabel} />
          <Image src={stepTwoImage} alt={dataVaultListLabels.howItWorksStepTwoImageLabel} />
          <Image src={stepThreeImage} alt={dataVaultListLabels.howItWorksStepThreeImageLabel} />
          <Image src={stepFourImage} alt={dataVaultListLabels.howItWorksStepFourImageLabel} />
        </ColumnLayout>
        <ColumnLayout columns={4}>
          {dataVaultListLabels.howItWorksStepOneDescription}
          {dataVaultListLabels.howItWorksStepTwoDescription}
          {dataVaultListLabels.howItWorksStepThreeDescription}
          {dataVaultListLabels.howItWorksStepFourDescription}
        </ColumnLayout>
      </Modal>
    );
  }

  function createNewDataVaultHandler() {
    return router.push('/create-data-vaults');
  }

  function nameCell(deaDataVault: DeaDataVault) {
    return (
      <Link
        data-test-id={deaDataVault.ulid}
        href={`${deaDataVault.ulid}`}
        onFollow={(e) => {
          e.preventDefault();
          return router.push(`/${props.detailPage}?dataVaultId=${e.detail.href}`);
        }}
      >
        {deaDataVault.name}
      </Link>
    );
  }

  function tableHeaderDescription(): React.ReactNode {
    return (
      <TextContent>
        <p>{props.headerDescription}</p>
        {dataVaultListLabels.fileTransferDescription}{' '}
        <Button variant="inline-link" onClick={enableHowItWorksModal}>
          {commonLabels.howItworksLabel}
        </Button>
      </TextContent>
    );
  }

  return (
    <Table
      {...collectionProps}
      data-testid="data-vaults-table"
      trackBy="name"
      loading={isLoading}
      variant="full-page"
      items={items}
      loadingText={dataVaultListLabels.loading}
      resizableColumns={true}
      empty={TableEmptyDisplay(
        dataVaultListLabels.noDataVaultsLabel,
        dataVaultListLabels.noDisplayLabel,
        <ActionContainer required={CREATE_DATA_VAULT_PATH} actions={availableEndpoints.data}>
          <Button onClick={createNewDataVaultHandler}>{dataVaultListLabels.createNewDataVaultLabel}</Button>
        </ActionContainer>
      )}
      header={
        <TableHeader
          data-testid="case-table-header"
          variant="awsui-h1-sticky"
          title={props.headerLabel}
          description={tableHeaderDescription()}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              {howItWorksModal()}
              <ActionContainer required={CREATE_DATA_VAULT_PATH} actions={availableEndpoints.data}>
                <Button
                  data-testid="create-data-vault-button"
                  variant="primary"
                  onClick={createNewDataVaultHandler}
                >
                  {dataVaultListLabels.createNewDataVaultLabel}
                </Button>
              </ActionContainer>
            </SpaceBetween>
          }
          totalItems={data}
        />
      }
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.nameHeader,
          cell: nameCell,
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
          id: 'totalSize',
          header: commonTableLabels.totalSize,
          cell: (e) => formatFileSize(e.totalSizeBytes),
          width: 220,
          minWidth: 165,
          sortingField: 'totalSizeBytes',
        },
        {
          id: 'created',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => formatDateFromISOString(e.created),
          width: 200,
          minWidth: 165,
          sortingField: 'created',
        },
      ]}
      filter={
        <SpaceBetween direction="vertical" size="xs">
          <PropertyFilter
            {...propertyFilterProps}
            countText={getFilterCounterText(filteredItemsCount)}
            i18nStrings={{
              ...i18nStrings,
              filteringPlaceholder: dataVaultListLabels.filteringPlaceholder,
              filteringAriaLabel: dataVaultListLabels.filteringPlaceholder,
            }}
            filteringOptions={filteringOptions}
            expandToViewport={true}
          />
        </SpaceBetween>
      }
      pagination={<Pagination {...paginationProps} ariaLabels={paginationLabels} />}
    />
  );
}

const getFilterCounterText = (count: number | undefined): string =>
  `${count} ${count === 1 ? 'match' : 'matches'}`;
export default DataVaultsTable;
