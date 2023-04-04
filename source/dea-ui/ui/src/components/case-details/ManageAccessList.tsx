/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { ColumnLayout, Header, SpaceBetween } from '@cloudscape-design/components';
import ManageAccessListItem from './ManageAccessListItem';

export interface ManageAccessListProps {
  readonly caseMembers: CaseUser[];
  readonly onRemoveMember: (user: CaseUser) => Promise<void>;
  readonly onUpdateMember: (user: CaseUser) => Promise<void>;
  readonly activeUser: CaseUser;
  readonly headertext: string;
}

function ManageAccessList(props: ManageAccessListProps): JSX.Element {
  const { caseMembers, onUpdateMember, onRemoveMember, activeUser } = props;

  return (
    <SpaceBetween size="s">
      <Header variant="h3">{props.headertext}</Header>
      <ColumnLayout borders="horizontal" columns={1} key="something">
        {caseMembers.map((caseMember) => (
          <ManageAccessListItem
            key={`${caseMember.caseUlid}-${caseMember.userUlid}`}
            caseMember={caseMember}
            onUpdateMember={(member: CaseUser) => onUpdateMember(member)}
            onRemoveMember={(member: CaseUser) => onRemoveMember(member)}
            activeUser={activeUser}
          ></ManageAccessListItem>
        ))}
      </ColumnLayout>
    </SpaceBetween>
  );
}

export default ManageAccessList;
