/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Tabs, TabsProps } from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import { useGetCaseActions } from '../../api/cases';
import { caseDetailLabels } from '../../common/labels';
import { canInvite, canViewFiles } from '../../helpers/userActionSupport';
import { CaseDetailsBodyProps } from './CaseDetailsBody';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

function CaseDetailsTabs(props: CaseDetailsBodyProps): JSX.Element {
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
          content: <CaseFilesTable caseId={props.caseId}></CaseFilesTable>,
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
