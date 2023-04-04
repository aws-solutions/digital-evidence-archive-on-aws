/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaUser } from '@aws/dea-app/lib/models/user';
import {
  BreadcrumbGroupProps,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { addCaseOwner, useGetScopedCaseInfoById } from '../../api/cases';
import { breadcrumbLabels, manageCaseAccessLabels } from '../../common/labels';
import BaseLayout from '../../components/BaseLayout';
import ManageAccessSearchUserForm from '../../components/case-details/ManageAccessSearchUserForm';
import { useNotifications } from '../../context/NotificationsContext';
import { useSettings } from '../../context/SettingsContext';

export default function ManageCasePage() {
  const { settings } = useSettings();
  const router = useRouter();
  const query = router.query;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const caseId = query.caseId as string;
  const { pushNotification } = useNotifications();
  const { data } = useGetScopedCaseInfoById(caseId);

  const caseIdString = caseId;

  async function addOwnerHandler(user: DeaUser) {
    const givenName = `${user.firstName} ${user.lastName}`;
    try {
      await addCaseOwner({ caseUlid: caseIdString, userUlid: user.ulid });
      pushNotification('success', manageCaseAccessLabels.addCaseOwnerSuccessMessage(givenName));
    } catch {
      pushNotification('error', manageCaseAccessLabels.addCaseOwnerFailMessage(givenName));
    }
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.homePageLabel,
      href: `/${settings.stage}/ui`,
    },
    {
      text: `${breadcrumbLabels.manageCaseLabel} ${caseId}`,
      href: '#',
    },
  ];
  return (
    <BaseLayout breadcrumbs={breadcrumbs}>
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <Header variant="h1">{data?.name}</Header>
          </SpaceBetween>
        }
      >
        <Container header={<Header variant="h2">{manageCaseAccessLabels.assignCaseOwnersLabel}</Header>}>
          <ManageAccessSearchUserForm onChange={addOwnerHandler}></ManageAccessSearchUserForm>
        </Container>
      </ContentLayout>
    </BaseLayout>
  );
}
