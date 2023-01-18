/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Tabs } from '@cloudscape-design/components';
import * as React from 'react';
import { caseDetailLabels } from '../../common/labels';
import AuditLogTable from './AuditLogTable';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

function CaseDetailsTabs(): JSX.Element {
  return (
    <Tabs
      tabs={[
        {
          label: caseDetailLabels.caseFilesLabel,
          id: 'caseFiles',
          content: <CaseFilesTable></CaseFilesTable>,
        },
        {
          label: caseDetailLabels.auditLogLabel,
          id: 'auditLog',
          content: <AuditLogTable></AuditLogTable>,
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