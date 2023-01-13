/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Table,
  Box,
  Button,
  TextFilter,
  Pagination,
  Link,
  StatusIndicator,
} from '@cloudscape-design/components';
import * as React from 'react';
import { useListAllCases } from '../../api/cases';
import { commonTableLabels, caseListLabels } from '../../common/labels';

function CaseTable(): JSX.Element {
  const { cases, areCasesLoading } = useListAllCases();

  const STAGE = 'test';

  // Property and date filter collections
  const { items } = useCollection(cases, {});

  return (
    <Table
      loading={areCasesLoading}
      columnDefinitions={[
        {
          id: 'name',
          header: commonTableLabels.caseNameHeader,
          cell: (e) => <Link href={`/${STAGE}/ui/${e.ulid}`}>{e.name}</Link>,
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
          cell: () => 'FOO, 00/00/00',
          width: 170,
          minWidth: 165,
          sortingField: 'creationDate',
        },
        {
          id: 'status',
          header: commonTableLabels.statusHeader,
          cell: (e) => (
            <StatusIndicator type={e.status === 'ACTIVE' ? 'success' : 'error'}>{e.status}</StatusIndicator>
          ),
          width: 170,
          minWidth: 165,
          sortingField: 'status',
        },
      ]}
      items={items}
      loadingText={caseListLabels.loading}
      resizableColumns
      selectionType="single"
      empty={
        <Box textAlign="center" color="inherit">
          <b>{caseListLabels.noCasesLabel}</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            {caseListLabels.noDisplayLabel}
          </Box>
          <Button>{caseListLabels.createNewCaseLabel}</Button>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder={caseListLabels.searchCasesLabel} filteringText="" />}
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

export default CaseTable;
