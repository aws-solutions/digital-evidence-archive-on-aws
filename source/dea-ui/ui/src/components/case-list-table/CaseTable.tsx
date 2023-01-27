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
import { TableEmptyDisplay, TableNoMatchDisplay } from '../common-components/CommonComponents';
import { i18nStrings } from '../common-components/commonDefinitions';
import { TableHeader } from '../common-components/TableHeader';
import { filteringOptions, filteringProperties, searchableColumns } from './caseListDefinitions';

function CaseTable(): JSX.Element {
  const router = useRouter();
  const { cases, areCasesLoading } = useListAllCases();

  const STAGE = 'test';

  // Property and date filter collections
  const { items, filteredItemsCount, propertyFilterProps } = useCollection(cases, {
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
              (value) => typeof value === 'string' && value.toLowerCase().indexOf(filteringTextLowerCase) > -1
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
      items={items}
      loadingText={caseListLabels.loading}
      resizableColumns={true}
      empty={TableEmptyDisplay(caseListLabels.noCasesLabel)}
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
          width: 350,
          minWidth: 220,
          sortingField: 'name',
        },
        {
          id: 'caseLead',
          header: commonTableLabels.caseLeadHeader,
          cell: () => 'Sherlock Holmes',
          width: 300,
          minWidth: 190,
          sortingField: 'caseLead',
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
          id: 'creationDate',
          header: commonTableLabels.creationDateHeader,
          cell: (e) => e.created,
          width: 200,
          minWidth: 165,
          sortingField: 'creationDate',
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
