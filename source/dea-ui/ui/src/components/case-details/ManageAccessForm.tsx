/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import { Container, Header } from '@cloudscape-design/components';
import { addCaseMember, removeCaseMember, updateCaseMember, useGetCaseMembers } from '../../api/cases';
import { manageCaseAccessLabels } from '../../common/labels';
import ManageAccessList from './ManageAccessList';
import ManageAccessSearchUserForm from './ManageAccessSearchUserForm';

export interface ManageAccessFormProps {
  readonly caseId: string;
}

function ManageAccessForm(props: ManageAccessFormProps): JSX.Element {
  const { data: caseMembers, mutate } = useGetCaseMembers(props.caseId);

  async function addCaseMemberHandler(user: DeaUser) {
    try {
      await addCaseMember({ caseUlid: props.caseId, userUlid: user.ulid, actions: [] });
    } finally {
      mutate();
    }
  }

  async function updateCaseMemberHandler(caseMember: CaseUser) {
    try {
      await updateCaseMember({
        caseUlid: caseMember.caseUlid,
        userUlid: caseMember.userUlid,
        actions: caseMember.actions,
      });
    } finally {
      mutate();
    }
  }

  async function removeCaseMemberHandler(caseMember: CaseUser) {
    try {
      await removeCaseMember(caseMember);
    } finally {
      mutate();
    }
  }

  return (
    <Container header={<Header variant="h2">{manageCaseAccessLabels.manageCaseAccessLabel}</Header>}>
      <ManageAccessSearchUserForm onChange={addCaseMemberHandler}></ManageAccessSearchUserForm>
      <ManageAccessList
        caseMembers={caseMembers}
        onUpdateMember={(member: CaseUser) => updateCaseMemberHandler(member)}
        onRemoveMember={(member: CaseUser) => removeCaseMemberHandler(member)}
      ></ManageAccessList>
    </Container>
  );
}

export default ManageAccessForm;
