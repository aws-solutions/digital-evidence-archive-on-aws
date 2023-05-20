/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { updateCaseMembership } from '../../../app/resources/update-case-membership';
import * as CaseService from '../../../app/services/case-service';
import { createCaseUserMembership, getCaseUser } from '../../../app/services/case-user-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseUser } from '../../../models/case-user';
import { DeaUser, DeaUserInput } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
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

    const deaCase: DeaCaseInput = {
      name: 'CaseForMembershipTest',
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUserInput = {
      tokenId: 'arthurmorgan',
      firstName: 'Arthur',
      lastName: 'Morgan',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

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

    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: targetMembership.userUlid,
      },
      body: JSON.stringify({
        userUlid: targetMembership.userUlid,
        caseUlid: targetMembership.caseUlid,
        actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.DOWNLOAD],
      }),
    });

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
    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: targetMembership.userUlid,
      },
      body: JSON.stringify({
        userUlid: targetMembership.userUlid,
        caseUlid: bogusUlid,
        actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.DOWNLOAD],
      }),
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case id does not match resource'
    );
  });

  it('should throw if the caseuser payload does not match the path userid', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: targetMembership.userUlid,
      },
      body: JSON.stringify({
        userUlid: bogusUlid,
        caseUlid: targetMembership.caseUlid,
        actions: [CaseAction.DOWNLOAD],
      }),
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested User id does not match resource'
    );
  });

  it('should throw if the case membership does not exist', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: bogusUlid,
      },
      body: JSON.stringify({
        userUlid: bogusUlid,
        caseUlid: targetMembership.caseUlid,
        actions: [CaseAction.DOWNLOAD],
      }),
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case-User Membership not found'
    );
  });

  it('should throw if the payload is missing', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: bogusUlid,
      },
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseUser payload missing.'
    );
  });

  it('should error if payload does include valid JSON', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: targetMembership.caseUlid,
        userId: bogusUlid,
      },
      body: {
        invalidJSON: 'invalidJSON',
        invalidJSON2: 'invalidJSON2',
      },
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseUser payload is malformed. Failed to parse.'
    );
  });

  it('should error if path params are missing', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
    });

    await expect(updateCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );

    const event2 = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
      },
    });

    await expect(updateCaseMembership(event2, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });
});
