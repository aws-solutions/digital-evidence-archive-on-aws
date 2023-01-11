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
import { useListAllCases } from '../api/cases';

function CaseTable(): JSX.Element {
  const { cases, areCasesLoading } = useListAllCases();

  // Property and date filter collections
  const { items } = useCollection(cases, {});

  return (
    <Table
      loading={areCasesLoading}
      columnDefinitions={[
        {
          id: 'name',
          header: 'Case name',
          cell: (e) => <Link href={`/prod/${e.ulid}`}>{e.name}</Link>,
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'caseLead',
          header: 'Case Lead(s)',
          cell: () => 'Sherlock Holmes',
          width: 110,
          minWidth: 110,
          sortingField: 'caseLead',
        },
        {
          id: 'objectCount',
          header: 'No. of files',
          cell: (e) => e.objectCount,
          width: 110,
          minWidth: 110,
          sortingField: 'objectCount',
        },
        {
          id: 'creationDate',
          header: 'Creation date',
          cell: () => 'FOO, 00/00/00',
          width: 110,
          minWidth: 110,
          sortingField: 'creationDate',
        },
        {
          id: 'status',
          header: 'Status',
          cell: (e) => (
            <StatusIndicator type={e.status === 'ACTIVE' ? 'success' : 'error'}>{e.status}</StatusIndicator>
          ),
          width: 110,
          minWidth: 110,
          sortingField: 'status',
        },
      ]}
      items={items}
      loadingText="Loading cases"
      resizableColumns
      selectionType="single"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No cases</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No cases to display.
          </Box>
          <Button>Create new case</Button>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder="Search by case name" filteringText="" />}
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
