/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { deleteCaseMembership } from '../../../app/resources/delete-case-membership';
import * as CaseService from '../../../app/services/case-service';
import { createCaseUserMembership, getCaseUser } from '../../../app/services/case-user-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { DeaUser, DeaUserInput } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

describe('delete case membership resource', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let testProviders: LambdaProviders;
  let caseOwner: DeaUser;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('deleteCaseMembershipTest');
    testProviders = createTestProvidersObject({ repositoryProvider });

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

  it('should remove an existing membership', async () => {
    const deaCase: DeaCaseInput = {
      name: 'VampireSurvivors',
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUserInput = {
      tokenId: 'FirstoneLastone',
      idPoolId: 'FirstoneLastoneidentityid',
      firstName: 'Firstone',
      lastName: 'Lastone',
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

    const event = getDummyEvent({
      pathParameters: {
        caseId: newCase.ulid,
        userId: user.ulid,
      },
    });

    // membership exists before delete
    expect(
      await getCaseUser({ caseUlid: newCase.ulid, userUlid: user.ulid }, repositoryProvider)
    ).toBeDefined();

    const response = await deleteCaseMembership(event, dummyContext, testProviders);
    expect(response.statusCode).toEqual(204);

    // membership is gone after delete
    expect(
      await getCaseUser({ caseUlid: newCase.ulid, userUlid: user.ulid }, repositoryProvider)
    ).toBeUndefined();
  });

  it('should make no alert for removing a membership that does not exist', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        userId: bogusUlid,
      },
    });

    const response = await deleteCaseMembership(event, dummyContext, testProviders);
    expect(response.statusCode).toEqual(204);
  });

  it('should error if path params are missing', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
    });

    await expect(deleteCaseMembership(event, dummyContext, testProviders)).rejects.toThrow(ValidationError);
    const event2 = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
      },
    });

    await expect(deleteCaseMembership(event2, dummyContext, testProviders)).rejects.toThrow(ValidationError);
  });
});
