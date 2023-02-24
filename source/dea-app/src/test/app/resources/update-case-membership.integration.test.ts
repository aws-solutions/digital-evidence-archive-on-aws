/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { updateCaseMembership } from '../../../app/resources/update-case-membership';
import * as CaseService from '../../../app/services/case-service';
import { createCaseUserMembership, getCaseUser } from '../../../app/services/case-user-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseStatus } from '../../../models/case-status';
import { CaseUser } from '../../../models/case-user';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;
let targetMembership: CaseUser;

describe('delete case membership resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('updateCaseMembershipTest');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();

    const deaCase: DeaCase = {
      name: 'CaseForMembershipTest',
      status: CaseStatus.ACTIVE,
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUser = {
      tokenId: 'arthurmorgan',
      firstName: 'Arthur',
      lastName: 'Morgan',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

    if (!newCase.ulid || !user.ulid) {
      fail();
    }

    await createCaseUserMembership(
      {
        caseUlid: newCase.ulid,
        userUlid: user.ulid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: newCase.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    const membership = await getCaseUser({ caseUlid: newCase.ulid, userUlid: user.ulid }, repositoryProvider);
    if (!membership) {
      fail('test case membership creation failed');
    }

    targetMembership = membership;
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should update an existing membership', async () => {
    expect(targetMembership?.actions).toEqual(expect.arrayContaining([CaseAction.VIEW_CASE_DETAILS]));

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: targetMembership.caseUlid,
          userId: targetMembership.userUlid,
        },
        body: JSON.stringify({
          userUlid: targetMembership.userUlid,
          caseUlid: targetMembership.caseUlid,
          actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.DOWNLOAD],
        }),
      }
    );

    const response = await updateCaseMembership(event, dummyContext, repositoryProvider);
    expect(response.statusCode).toEqual(200);
    const membershipAfter = await getCaseUser(
      { caseUlid: targetMembership.caseUlid, userUlid: targetMembership.userUlid },
      repositoryProvider
    );
    expect(membershipAfter?.actions).toEqual(
      expect.arrayContaining([CaseAction.VIEW_CASE_DETAILS, CaseAction.DOWNLOAD])
    );
  });

  it('should throw if the caseuser payload does not match the path caseid', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: targetMembership.caseUlid,
          userId: targetMembership.userUlid,
        },
        body: JSON.stringify({
          userUlid: targetMembership.userUlid,
          caseUlid: bogusUlid,
          actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.DOWNLOAD],
        }),
      }
    );

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case id does not match resource'
    );
  });

  it('should throw if the caseuser payload does not match the path userid', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: targetMembership.caseUlid,
          userId: targetMembership.userUlid,
        },
        body: JSON.stringify({
          userUlid: bogusUlid,
          caseUlid: targetMembership.caseUlid,
          actions: [CaseAction.DOWNLOAD],
        }),
      }
    );

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested User id does not match resource'
    );
  });

  it('should throw if the case membership does not exist', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: targetMembership.caseUlid,
          userId: bogusUlid,
        },
        body: JSON.stringify({
          userUlid: bogusUlid,
          caseUlid: targetMembership.caseUlid,
          actions: [CaseAction.DOWNLOAD],
        }),
      }
    );

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case-User Membership not found'
    );
  });

  it('should throw if the payload is missing', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: targetMembership.caseUlid,
          userId: bogusUlid,
        },
      }
    );

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseUser payload missing.'
    );
  });

  it('should error if path params are missing', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: bogusUlid,
        },
      }
    );

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          userId: bogusUlid,
        },
      }
    );

    await expect(updateCaseMembership(event2, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });
});
