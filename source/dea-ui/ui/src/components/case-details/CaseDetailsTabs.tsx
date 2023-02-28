/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Container, Tabs } from '@cloudscape-design/components';
import * as React from 'react';
import { caseDetailLabels } from '../../common/labels';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

function CaseDetailsTabs(): JSX.Element {
  return (
    <Tabs
      data-testid="case-details-tabs"
      tabs={[
        {
          label: caseDetailLabels.caseFilesLabel,
          id: 'caseFiles',
          content: <CaseFilesTable></CaseFilesTable>,
        },
        {
          label: caseDetailLabels.auditLogLabel,
          id: 'auditLog',
          content: <Container>Audit Log Download</Container>,
        },
        {
          label: caseDetailLabels.manageAccessLabel,
          id: 'caseAccess',
          content: <ManageAccessForm></ManageAccessForm>,
        },
      ]}
    />
  );
}

export default CaseDetailsTabs;
