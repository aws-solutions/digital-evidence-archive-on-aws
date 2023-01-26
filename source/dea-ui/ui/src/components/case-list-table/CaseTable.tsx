/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '@aws/dea-app';
import { PropertyFilterProperty, useCollection } from '@cloudscape-design/collection-hooks';
import {
  Table,
  Box,
  Button,
  Pagination,
  Link,
  SpaceBetween,
  PropertyFilter,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useListAllCases } from '../../api/cases';
import { commonTableLabels, caseListLabels } from '../../common/labels';
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/common-components';
import { TableHeader } from '../common-components/TableHeader';

export const filteringProperties: readonly PropertyFilterProperty[] = [
  {
    key: 'name',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Case Name',
    groupValuesLabel: 'Case Name Values',
  },
  {
    key: 'caseLead',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Case Lead',
    groupValuesLabel: 'Case Lead Values',
  },
  {
    key: 'created',
    operators: ['<', '<=', '>', '>=', ':'],
    propertyLabel: 'Creation Date',
    groupValuesLabel: 'Creation Date Values',
  },
];

export const searchableColumns: string[] = ['name', 'caseLead', 'creationDate'];

function CaseTable(): JSX.Element {
  const router = useRouter();
  const { cases, areCasesLoading } = useListAllCases();

  const STAGE = 'test';

  // Property and date filter collections
  const { items, actions, filteredItemsCount, collectionProps, paginationProps, propertyFilterProps } =
    useCollection(cases, {
      filtering: {
        empty: TableEmptyDisplay(caseListLabels.noCasesLabel),
        noMatch: TableNoMatchDisplay(caseListLabels.noCasesLabel),
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
        empty: TableEmptyDisplay(caseListLabels.noCasesLabel),
        noMatch: TableNoMatchDisplay(caseListLabels.noCasesLabel),
      },
      sorting: {},
      selection: {},
    });
  function createNewCaseHandler() {
    router.push('/create-cases');
  }

  return (
    <Table
      loading={areCasesLoading}
      variant="full-page"
      header={
        <TableHeader
          variant="awsui-h1-sticky"
          title={caseListLabels.casesLabel}
          description={caseListLabels.casesPageDescription}
          actionButtons={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={createNewCaseHandler}>
                {caseListLabels.createNewCaseLabel}
              </Button>{' '}
            </SpaceBetween>
          }
          totalItems={cases}
        />
      }
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.caseNameHeader,
          cell: (e) => (
            <Link
              href={`/${e.ulid}`}
              onFollow={(e) => {
                e.preventDefault();
                router.push(`${e.detail.href}`);
              }}
            >
              {e.name}
            </Link>
          ),
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'caseLead',
          header: commonTableLabels.caseLeadHeader,
          cell: () => 'Sherlock Holmes',
          width: 170,
          minWidth: 165,
          sortingField: 'caseLead',
        },
        {
          id: 'objectCount',
          header: commonTableLabels.objectCounterHeader,
          cell: (e) => e.objectCount,
          width: 170,
          minWidth: 165,
          sortingField: 'objectCount',
        },
        {
          id: 'creationDate',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => e.created,
          width: 170,
          minWidth: 165,
          sortingField: 'creationDate',
        },
      ]}
      items={items}
      loadingText={caseListLabels.loading}
      resizableColumns={true}
      empty={
        <Box textAlign="center" color="inherit">
          <b>{caseListLabels.noCasesLabel}</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            {caseListLabels.noDisplayLabel}
          </Box>
          <Button>{caseListLabels.createNewCaseLabel}</Button>
        </Box>
      }
      filter={
        <SpaceBetween direction="vertical" size="xs">
          <PropertyFilter
            {...propertyFilterProps}
            countText={getFilterCounterText(filteredItemsCount)}
            i18nStrings={{
              filteringAriaLabel: 'your choice',
              dismissAriaLabel: 'Dismiss',
              filteringPlaceholder: 'Search',
              groupValuesText: 'Values',
              groupPropertiesText: 'Properties',
              operatorsText: 'Operators',
              operationAndText: 'and',
              operationOrText: 'or',
              operatorLessText: 'Less than',
              operatorLessOrEqualText: 'Less than or equal',
              operatorGreaterText: 'Greater than',
              operatorGreaterOrEqualText: 'Greater than or equal',
              operatorContainsText: 'Contains',
              operatorDoesNotContainText: 'Does not contain',
              operatorEqualsText: 'Equals',
              operatorDoesNotEqualText: 'Does not equal',
              editTokenHeader: 'Edit filter',
              propertyText: 'Property',
              operatorText: 'Operator',
              valueText: 'Value',
              cancelActionText: 'Cancel',
              applyActionText: 'Apply',
              allPropertiesLabel: 'All properties',
              tokenLimitShowMore: 'Show more',
              tokenLimitShowFewer: 'Show fewer',
              clearFiltersText: 'Clear filters',
              removeTokenButtonAriaLabel: () => 'Remove token',
              enteredTextLabel: (text) => `Use: "${text}"`,
            }}
            filteringOptions={[
              { propertyKey: 'caseLead', value: '' },
              { propertyKey: 'name', value: '' },
              { propertyKey: 'creationDate', value: '' },
            ]}
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
