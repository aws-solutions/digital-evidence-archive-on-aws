/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Link, Pagination, PropertyFilter, SpaceBetween, Table } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { DeaListResult } from '../../api/cases';
import { DeaCaseDTO } from '../../api/models/case';
import { caseListLabels, commonTableLabels } from '../../common/labels';
import { formatDateFromISOString } from '../../helpers/dateHelper';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './caseListDefinitions';

export type CaseFetcherSignature = () => DeaListResult<DeaCaseDTO>;
export interface CaseTableProps {
  useCaseFetcher: CaseFetcherSignature;
  canCreate: boolean;
  detailPage: string;
  headerLabel: string;
}

function CaseTable(props: CaseTableProps): JSX.Element {
  const router = useRouter();
  const { data, isLoading } = props.useCaseFetcher();

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

  return (
    <Table
      {...collectionProps}
      data-testid="case-table"
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
              {props.canCreate && (
                <Button data-testid="create-case-button" variant="primary" onClick={createNewCaseHandler}>
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
