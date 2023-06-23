/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import { DeaUser } from '@aws/dea-app/lib/models/user';
import { Button, Container, Form, Header, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { addCaseMember, removeCaseMember, updateCaseMember, useGetCaseMembers } from '../../api/cases';
import { commonLabels, manageCaseAccessLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';
import ManageAccessList from './ManageAccessList';
import ManageAccessSearchUserForm from './ManageAccessSearchUserForm';

export interface ManageAccessFormProps {
  readonly caseId: string;
  readonly activeUser: CaseUser;
}

function ManageAccessForm(props: ManageAccessFormProps): JSX.Element {
  const { data: caseMembers, mutate } = useGetCaseMembers(props.caseId);
  const { pushNotification } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  const [modifiedMembers, setModifiedMembers] = useState<CaseUser[]>([]);

  async function addCaseMemberHandler(user: DeaUser) {
    const givenName = `${user.firstName} ${user.lastName}`;
    try {
      await addCaseMember({
        caseUlid: props.caseId,
        userUlid: user.ulid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      });
      pushNotification('success', manageCaseAccessLabels.addCaseMemberSuccessMessage(givenName));
    } catch {
      pushNotification('error', manageCaseAccessLabels.addCaseMemberFailMessage(givenName));
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

  async function updateCaseMemberHandler(caseMember: CaseUser) {
    const foundIndex = modifiedMembers.findIndex((element) => element.userUlid === caseMember.userUlid);
    setModifiedMembers(
      foundIndex === -1
        ? [...modifiedMembers, caseMember]
        : [...modifiedMembers.slice(0, foundIndex), ...modifiedMembers.slice(foundIndex + 1), caseMember]
    );
  }

  async function saveHandler() {
    try {
      setIsSaving(true);
      for (const caseMember of modifiedMembers) {
        await updateCaseMember({
          caseUlid: caseMember.caseUlid,
          userUlid: caseMember.userUlid,
          actions: caseMember.actions,
        });
      }
      setModifiedMembers([]);
      pushNotification('success', manageCaseAccessLabels.saveSuccessMessage);
    } catch {
      pushNotification('error', manageCaseAccessLabels.saveFailMessage);
    } finally {
      setIsSaving(false);
      mutate();
    }
  }

  return (
    <Form
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" disabled={modifiedMembers.length === 0 || isSaving} onClick={saveHandler}>
            {commonLabels.saveUpdatesButton}
          </Button>
        </SpaceBetween>
      }
    >
      <Container header={<Header variant="h2">{manageCaseAccessLabels.manageCaseAccessLabel}</Header>}>
        <ManageAccessSearchUserForm onChange={addCaseMemberHandler}></ManageAccessSearchUserForm>
        <ManageAccessList
          headertext={manageCaseAccessLabels.manageCasePeopleAccessLabel}
          caseMembers={caseMembers}
          onUpdateMember={(member: CaseUser) => updateCaseMemberHandler(member)}
          onRemoveMember={(member: CaseUser) => removeCaseMemberHandler(member)}
          activeUser={props.activeUser}
        ></ManageAccessList>
      </Container>
    </Form>
  );
}

export default ManageAccessForm;
