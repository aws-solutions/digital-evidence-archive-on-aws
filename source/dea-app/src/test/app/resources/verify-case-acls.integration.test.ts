/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { verifyCaseACLs } from '../../../app/resources/verify-case-acls';
import { createCases } from '../../../app/services/case-service';
import { createCaseUserMembership } from '../../../app/services/case-user-service';
import { createUser } from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

const requiredActions = [CaseAction.VIEW_CASE_DETAILS, CaseAction.UPDATE_CASE_DETAILS, CaseAction.DOWNLOAD];
let theCase: DeaCase;
let owner: DeaUser;
let userWithAllACLs: DeaUser;
let userWithNoMembership: DeaUser;
let userWithMembershipNoAcls: DeaUser;
let userWithMembershipPartialAcls: DeaUser;

describe('verify case ACLs', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('verifyCaseACLsTest');

    owner = await createUser(
      {
        firstName: 'Owen',
        lastName: 'Doe',
        tokenId: 'token',
      },
      repositoryProvider
    );
    userWithAllACLs = await createUser(
      {
        firstName: 'UserA',
        lastName: 'Doe',
        tokenId: 'token',
      },
      repositoryProvider
    );
    userWithNoMembership = await createUser(
      {
        firstName: 'UserB',
        lastName: 'Doe',
        tokenId: 'token',
      },
      repositoryProvider
    );
    userWithMembershipNoAcls = await createUser(
      {
        firstName: 'UserC',
        lastName: 'Doe',
        tokenId: 'token',
      },
      repositoryProvider
    );
    userWithMembershipPartialAcls = await createUser(
      {
        firstName: 'UserD',
        lastName: 'Doe',
        tokenId: 'token',
      },
      repositoryProvider
    );

    theCase = await createCases(
      {
        name: 'theCase',
        status: CaseStatus.ACTIVE,
      },
      owner,
      repositoryProvider
    );

    if (!theCase.ulid) {
      fail();
    }
    if (!userWithAllACLs.ulid) {
      fail();
    }
    if (!userWithNoMembership.ulid) {
      fail();
    }
    if (!userWithMembershipNoAcls.ulid) {
      fail();
    }
    if (!userWithMembershipPartialAcls.ulid) {
      fail();
    }

    await createCaseUserMembership(
      {
        caseUlid: theCase.ulid,
        userUlid: userWithAllACLs.ulid,
        caseName: theCase.name,
        userFirstName: userWithAllACLs.firstName,
        userLastName: userWithAllACLs.lastName,
        actions: requiredActions,
      },
      repositoryProvider
    );

    await createCaseUserMembership(
      {
        caseUlid: theCase.ulid,
        userUlid: userWithMembershipNoAcls.ulid,
        caseName: theCase.name,
        userFirstName: userWithMembershipNoAcls.firstName,
        userLastName: userWithMembershipNoAcls.lastName,
        actions: [],
      },
      repositoryProvider
    );

    await createCaseUserMembership(
      {
        caseUlid: theCase.ulid,
        userUlid: userWithMembershipPartialAcls.ulid,
        caseName: theCase.name,
        userFirstName: userWithMembershipPartialAcls.firstName,
        userLastName: userWithMembershipPartialAcls.lastName,
        actions: [requiredActions[0]],
      },
      repositoryProvider
    );
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should not throw if a user has all required acls', async () => {
    // GIVEN a user with membership and all acls
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: userWithAllACLs.ulid,
        },
      }
    );

    // WHEN verifying ACLs, THEN sut doesn't throw
    await verifyCaseACLs(event, requiredActions, repositoryProvider);

    //try with the owner
    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: owner.ulid,
        },
      }
    );
    await verifyCaseACLs(event2, requiredActions, repositoryProvider);
  });

  it('should not throw if there are no defined ACLs', async () => {
    // GIVEN a user
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: userWithNoMembership.ulid,
        },
      }
    );

    // WHEN no ACLs are specified, THEN sut doesn't throw
    await verifyCaseACLs(event, []);
  });

  it('should throw if a user has no membership', async () => {
    // GIVEN a user with no membership
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: userWithNoMembership.ulid,
        },
      }
    );

    // WHEN verifying ACLs, THEN sut throws forbidden error
    await expect(verifyCaseACLs(event, requiredActions, repositoryProvider)).rejects.toThrow(NotFoundError);
  });

  it('should throw if a user has no required acls', async () => {
    // GIVEN a user with membership but no ACLs
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: userWithMembershipNoAcls.ulid,
        },
      }
    );

    // WHEN verifying ACLs, THEN sut throws forbidden error
    await expect(verifyCaseACLs(event, requiredActions, repositoryProvider)).rejects.toThrow(NotFoundError);
  });

  it('should throw if a user has partial required acls', async () => {
    // GIVEN a user with membership but partial ACLs
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: theCase.ulid,
        },
        headers: {
          userUlid: userWithMembershipPartialAcls.ulid,
        },
      }
    );

    // WHEN verifying ACLs, THEN sut throws forbidden error
    await expect(verifyCaseACLs(event, requiredActions, repositoryProvider)).rejects.toThrow(NotFoundError);
  });
});
