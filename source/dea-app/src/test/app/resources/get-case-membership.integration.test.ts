/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { getCaseMembership } from '../../../app/resources/get-case-membership';
import { createCases } from '../../../app/services/case-service';
import { createCaseUserMembership } from '../../../app/services/case-user-service';
import { createUser } from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseUser } from '../../../models/case-user';
import { DeaUser, DeaUserInput } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

type ResponseCaseUserPage = {
  caseUsers: CaseUser[];
  next: string | undefined;
};

describe('getCaseMembership', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getCaseMembershipTest');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          idPoolId: 'caseowneridentityid',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should return all users with membership on a case', async () => {
    // GIVEN a case
    const deaCase: DeaCaseInput = {
      name: 'CaseUnderTest',
    };
    const caseUnderTest = await createCases(deaCase, caseOwner, repositoryProvider);

    // AND a first user get's invited to the case
    const userToBeInvited1: DeaUserInput = {
      tokenId: 'user1',
      idPoolId: 'user1identityid',
      firstName: 'Alice',
      lastName: 'First',
    };

    const user1 = await createUser(userToBeInvited1, repositoryProvider);
    await createCaseUserMembership(
      {
        caseUlid: caseUnderTest.ulid,
        userUlid: user1.ulid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: caseUnderTest.name,
        userFirstName: user1.firstName,
        userLastName: user1.lastName,
      },
      repositoryProvider
    );

    // AND a second user get's invited to the case
    const userToBeInvited2: DeaUserInput = {
      tokenId: 'user2',
      idPoolId: 'user2identityid',
      firstName: 'Bob',
      lastName: 'Second',
    };

    const user2 = await createUser(userToBeInvited2, repositoryProvider);
    await createCaseUserMembership(
      {
        caseUlid: caseUnderTest.ulid,
        userUlid: user2.ulid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: caseUnderTest.name,
        userFirstName: user2.firstName,
        userLastName: user2.lastName,
      },
      repositoryProvider
    );

    // WHEN requesting the user's membership on a case
    const event = getDummyEvent({
      queryStringParameters: {
        limit: '20',
      },
      pathParameters: {
        caseId: caseUnderTest.ulid,
      },
    });

    // THEN all users with membership on a case are returned.
    const response = await getCaseMembership(event, dummyContext, repositoryProvider);
    const caseUsers: CaseUser[] = JSON.parse(response.body).caseUsers;

    // caseowner
    expect(
      caseUsers.find(
        (caseUser) =>
          caseUser.caseName === caseUnderTest.name &&
          caseUser.userFirstName === caseOwner.firstName &&
          caseUser.userLastName === caseOwner.lastName
      )
    ).toBeDefined();
    // user1
    expect(
      caseUsers.find(
        (caseUser) =>
          caseUser.caseName === caseUnderTest.name &&
          caseUser.userFirstName === user1.firstName &&
          caseUser.userLastName === user1.lastName
      )
    ).toBeDefined();
    // user2
    expect(
      caseUsers.find(
        (caseUser) =>
          caseUser.caseName === caseUnderTest.name &&
          caseUser.userFirstName === user2.firstName &&
          caseUser.userLastName === user2.lastName
      )
    ).toBeDefined();
  });

  it('should fetch cases across pages', async () => {
    // GIVEN a case
    const deaCase: DeaCaseInput = {
      name: 'CaseMultiPagging',
    };
    const caseUnderTest = await createCases(deaCase, caseOwner, repositoryProvider);

    // AND multiple users get invited to the case
    const inviteSize = 25;
    for (let i = 0; i < inviteSize; ++i) {
      const userToBeInvited: DeaUserInput = {
        tokenId: `tokenId${i}`,
        idPoolId: `identityid${i}`,
        firstName: `firstName${i}`,
        lastName: `lastName${i}`,
      };
      const userMember = await createUser(userToBeInvited, repositoryProvider);

      await createCaseUserMembership(
        {
          caseUlid: caseUnderTest.ulid,
          userUlid: userMember.ulid,
          actions: [CaseAction.VIEW_CASE_DETAILS],
          caseName: caseUnderTest.name,
          userFirstName: userMember.firstName,
          userLastName: userMember.lastName,
        },
        repositoryProvider
      );
    }

    // WHEN requesting the first page of the user's membership on a case
    const pageSize1 = 1;
    const event = getDummyEvent({
      queryStringParameters: {
        limit: `${pageSize1}`,
      },
      pathParameters: {
        caseId: caseUnderTest.ulid,
      },
    });

    const response = await getCaseMembership(event, dummyContext, repositoryProvider);

    // THEN only the page size of membership on a case are returned.
    if (!response.body) {
      fail();
    }

    const caseUsersPage: ResponseCaseUserPage = JSON.parse(response.body);
    expect(caseUsersPage.caseUsers.length).toEqual(pageSize1);
    expect(caseUsersPage.next).toBeTruthy();

    const event2 = getDummyEvent({
      queryStringParameters: {
        next: caseUsersPage.next,
      },
      pathParameters: {
        caseId: caseUnderTest.ulid,
      },
    });

    const response2 = await getCaseMembership(event2, dummyContext, repositoryProvider);
    if (!response2.body) {
      fail();
    }

    // remainingCount = inviteSize - pageSize1 + caseowner
    const remainingCount = inviteSize - pageSize1 + 1;
    const casesPage2: ResponseCaseUserPage = JSON.parse(response2.body);
    expect(casesPage2.caseUsers.length).toEqual(remainingCount);
    expect(casesPage2.next).toBeFalsy();
  });

  it('should give an error when the case does not exist', async () => {
    // GIVEN a case does not exist
    // WHEN requesting the user's membership on a case
    const event = getDummyEvent({
      queryStringParameters: {
        limit: '20',
      },
      pathParameters: {
        caseId: bogusUlid,
      },
    });

    // Then throw NotFoundError
    await expect(getCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
  });
});
