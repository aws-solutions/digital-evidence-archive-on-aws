/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { ColumnLayout, Header, SpaceBetween } from '@cloudscape-design/components';
import { manageCaseAccessLabels } from '../../common/labels';
import ManageAccessListItem from './ManageAccessListItem';

export interface ManageAccessListProps {
  readonly caseMembers: CaseUser[];
  readonly onRemoveMember: (user: CaseUser) => void;
  readonly onUpdateMember: (user: CaseUser) => void;
}

function ManageAccessList(props: ManageAccessListProps): JSX.Element {
  const { caseMembers, onUpdateMember, onRemoveMember } = props;

  return (
    <SpaceBetween size="s">
      <Header variant="h3">{manageCaseAccessLabels.manageCasePeopleAccessLabel}</Header>
      <ColumnLayout borders="horizontal" columns={1}>
        {caseMembers.map((caseMember) => (
          <ManageAccessListItem
            key={caseMember.userUlid}
            caseMember={caseMember}
            onUpdateMember={(member: CaseUser) => onUpdateMember(member)}
            onRemoveMember={(member: CaseUser) => onRemoveMember(member)}
          ></ManageAccessListItem>
        ))}
      </ColumnLayout>
    </SpaceBetween>
  );
}

export default ManageAccessList;
