import { Tabs } from '@cloudscape-design/components';
import * as React from 'react';
import AuditLogTable from './AuditLogTable';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

function CaseDetailsTabs(): JSX.Element {
  return (
    <Tabs
      tabs={[
        {
          label: 'Case Files',
          id: 'caseFiles',
          content: <CaseFilesTable></CaseFilesTable>,
        },
        {
          label: 'Audit Log',
          id: 'auditLog',
          content: <AuditLogTable></AuditLogTable>,
        },
        {
          label: 'Manage case access',
          id: 'caseAccess',
          content: <ManageAccessForm></ManageAccessForm>,
        },
      ]}
    />
  );
}

export default CaseDetailsTabs;
