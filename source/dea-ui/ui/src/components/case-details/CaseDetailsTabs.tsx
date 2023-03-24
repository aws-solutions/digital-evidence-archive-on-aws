/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { Tabs } from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import { useGetCaseActions } from '../../api/cases';
import { caseDetailLabels } from '../../common/labels';
import { CaseDetailsBodyProps } from './CaseDetailsBody';
import CaseFilesTable from './CaseFilesTable';
import ManageAccessForm from './ManageAccessForm';

function CaseDetailsTabs(props: CaseDetailsBodyProps): JSX.Element {
  const { data } = useGetCaseActions(props.caseId);
  const [tabs, setTabs] = useState([
    {
      label: caseDetailLabels.caseFilesLabel,
      id: 'caseFiles',
      content: <CaseFilesTable caseId={props.caseId}></CaseFilesTable>,
    },
  ]);
  useMemo(
    () => {
      if (!data) {
        // do nothing.
        return;
      }
      if (data.actions.find((action) => action === CaseAction.INVITE)) {
        setTabs([
          ...tabs,
          {
            label: caseDetailLabels.manageAccessLabel,
            id: 'caseAccess',
            content: <ManageAccessForm caseId={props.caseId} activeUser={data}></ManageAccessForm>,
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );
  return <Tabs data-testid="case-details-tabs" tabs={tabs} />;
}

export default CaseDetailsTabs;
