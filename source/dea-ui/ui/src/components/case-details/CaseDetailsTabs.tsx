/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from '@aws/dea-app/lib/models/case-status';
import { Tabs, TabsProps } from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import { useGetCaseActions } from '../../api/cases';
import { caseDetailLabels } from '../../common/labels';
import { canInvite, canViewFiles } from '../../helpers/userActionSupport';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

export interface CaseDetailsTabsProps {
  readonly caseId: string;
  readonly caseStatus: CaseStatus;
}

function CaseDetailsTabs(props: CaseDetailsTabsProps): JSX.Element {
  const { data } = useGetCaseActions(props.caseId);
  const [tabs, setTabs] = useState<TabsProps.Tab[]>([]);
  useMemo(
    () => {
      if (!data) {
        // do nothing.
        return;
      }
      const tabsContents: TabsProps.Tab[] = [];
      if (canViewFiles(data.actions)) {
        tabsContents.push({
          label: caseDetailLabels.caseFilesLabel,
          id: 'caseFiles',
          content: <CaseFilesTable caseId={props.caseId} caseStatus={props.caseStatus}></CaseFilesTable>,
        });
      }
      if (canInvite(data.actions)) {
        tabsContents.push({
          label: caseDetailLabels.manageAccessLabel,
          id: 'caseAccess',
          content: <ManageAccessForm caseId={props.caseId} activeUser={data}></ManageAccessForm>,
        });
      }
      setTabs(tabsContents);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );
  return <Tabs data-testid="case-details-tabs" tabs={tabs} />;
}

export default CaseDetailsTabs;
