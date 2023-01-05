import * as React from 'react';
import { Table, Box, Button, Header, TextFilter, Pagination } from '@cloudscape-design/components';

export default () => {
  return (
    <Table
      columnDefinitions={[
        {
          id: 'name',
          header: 'Case name',
          cell: (e) => e.name,
          width: 170,
          minWidth: 165,
          sortingField: 'name',
        },
        {
          id: 'status',
          header: 'Status',
          cell: (e) => e.status,
          width: 110,
          minWidth: 110,
          sortingField: 'status',
        },
      ]}
      items={[
        {
          ulid: '01GMRP6ZEMJN18KTKWHRDZQ625',
          name: 'dev tee3st7',
          description: 'test update 01GMRP6ZEMJN18KTKWHRDZQ625',
          objectCount: 0,
          status: 'ACTIVE',
        },
        {
          ulid: '01GMRRNWK08JWATZW098Z0M880',
          name: 'Murder case 1',
          description: 'suspect of murdered cupcake might be wife',
          objectCount: 0,
          status: 'ACTIVE',
        },
        {
          ulid: '01GMSDRAW5EAACAV4AB4A0YG73',
          name: 'Murder case 12',
          description: 'suspect of murdered cupcake might be wife',
          objectCount: 0,
          status: 'ACTIVE',
        },
      ]}
      loadingText="Loading resources"
      resizableColumns
      empty={
        <Box textAlign="center" color="inherit">
          <b>No resources</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No resources to display.
          </Box>
          <Button>Create resource</Button>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder="Find resources" filteringText="" />}
      header={<Header>Table with resizable columns</Header>}
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
};
