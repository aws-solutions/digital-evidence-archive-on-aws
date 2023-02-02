/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  Table,
  Box,
  Button,
  TextFilter,
  Pagination,
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import * as React from 'react';
import { auditLogLabels, commonTableLabels } from '../../common/labels';

function AuditLogTable(): JSX.Element {
  // Property and date filter collections
  const items = [
    {
      userName: 'Moriarty',
      fileName: 'Dummy file 1',
      fileType: 'jpeg',
      timestamp: '12/02/22 12:00PM ET',
      action: 'Do bad things',
      reason: 'Beat Sherlock',
    },
    {
      userName: 'John Watson',
      fileName: 'Dummy file 2',
      fileType: 'doc',
      timestamp: '12/02/22 12:00PM ET',
      action: 'Do good things',
      reason: 'Help Sherlock',
    },
    {
      userName: 'John Watson',
      fileName: 'Dummy file 3',
      fileType: 'xml',
      timestamp: '12/02/22 12:00PM ET',
      action: 'Do good things',
      reason: 'Help Sherlock',
    },
  ];

  return (
    <Table
      data-testid="audit-table"
      columnDefinitions={[
        {
          id: 'timestamp',
          header: commonTableLabels.timestampHeader,
          cell: (e) => e.timestamp,
          width: 170,
          minWidth: 165,
          sortingField: 'timestamp',
        },
        {
          id: 'userName',
          header: commonTableLabels.nameHeader,
          cell: (e) => e.userName,
          width: 170,
          minWidth: 165,
          sortingField: 'userName',
        },
        {
          id: 'fileName',
          header: commonTableLabels.fileNameHeader,
          cell: (e) => e.fileName,
          width: 170,
          minWidth: 165,
          sortingField: 'fileName',
        },
        {
          id: 'action',
          header: commonTableLabels.actionHeader,
          cell: (e) => e.action,
          width: 170,
          minWidth: 165,
          sortingField: 'action',
        },
        {
          id: 'reason',
          header: commonTableLabels.reasonHeader,
          cell: (e) => e.reason,
          width: 170,
          minWidth: 165,
          sortingField: 'reason',
        },
      ]}
      items={items}
      loadingText={auditLogLabels.loadingLabel}
      resizableColumns
      selectionType="single"
      empty={
        <Box textAlign="center" color="inherit">
          <b>{auditLogLabels.emptyAuditLabel}</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            {auditLogLabels.noDisplayAuditLabel}
          </Box>
        </Box>
      }
      filter={<TextFilter filteringPlaceholder="Search by timestamp" filteringText="" />}
      header={
        <Header
          variant="h2"
          description={auditLogLabels.descriptionLabel}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary">{auditLogLabels.downloadCSVLabel}</Button>
            </SpaceBetween>
          }
        >
          {auditLogLabels.caseAuditLogLabel}
        </Header>
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

export default AuditLogTable;
