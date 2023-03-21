/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import { Container, Header } from '@cloudscape-design/components';
import { addCaseMember, removeCaseMember, updateCaseMember, useGetCaseMembers } from '../../api/cases';
import { manageCaseAccessLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import ManageAccessList from './ManageAccessList';
import ManageAccessSearchUserForm from './ManageAccessSearchUserForm';

export interface ManageAccessFormProps {
  readonly caseId: string;
}

function ManageAccessForm(props: ManageAccessFormProps): JSX.Element {
  const { data: caseMembers, mutate } = useGetCaseMembers(props.caseId);
  const { pushNotification } = useNotifications();

  async function addCaseMemberHandler(user: DeaUser) {
    const givenName = `${user.firstName} ${user.lastName}`;
    try {
      await addCaseMember({ caseUlid: props.caseId, userUlid: user.ulid, actions: [] });
      pushNotification('success', manageCaseAccessLabels.addCaseMemberSuccessMessage(givenName));
    } catch {
      pushNotification('error', manageCaseAccessLabels.addCaseMemberFailMessage(givenName));
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
    const givenName = `${caseMember.userFirstName} ${caseMember.userLastName}`;
    try {
      await removeCaseMember(caseMember);
      pushNotification('success', manageCaseAccessLabels.removeCaseMemberSuccessMessage(givenName));
    } catch {
      pushNotification('error', manageCaseAccessLabels.removeCaseMemberFailMessage(givenName));
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
