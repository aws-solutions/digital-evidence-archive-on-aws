/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { deleteCaseMembership } from '../../../app/resources/delete-case-membership';
import * as CaseService from '../../../app/services/case-service';
import { createCaseUserMembership, getCaseUser } from '../../../app/services/case-user-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

describe('delete case membership resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('deleteCaseMembershipTest');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should remove an existing membership', async () => {
    const deaCase: DeaCase = {
      name: 'VampireSurvivors',
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

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: newCase.ulid,
          userId: user.ulid,
        },
      }
    );

    // membership exists before delete
    expect(
      await getCaseUser({ caseUlid: newCase.ulid, userUlid: user.ulid }, repositoryProvider)
    ).toBeDefined();

    const response = await deleteCaseMembership(event, dummyContext, repositoryProvider);
    expect(response.statusCode).toEqual(204);

    // membership is gone after delete
    expect(
      await getCaseUser({ caseUlid: newCase.ulid, userUlid: user.ulid }, repositoryProvider)
    ).toBeUndefined();
  });

  it('should make no alert for removing a membership that does not exist', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: bogusUlid,
          userId: bogusUlid,
        },
      }
    );

    const response = await deleteCaseMembership(event, dummyContext, repositoryProvider);
    expect(response.statusCode).toEqual(204);
  });

  it('should error if path params are missing', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: 'boguscase',
        },
      }
    );

    await expect(deleteCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          userId: 'boguscase',
        },
      }
    );

    await expect(deleteCaseMembership(event2, dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });
});
