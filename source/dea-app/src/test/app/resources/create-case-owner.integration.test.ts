/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { createCaseMembership } from '../../../app/resources/create-case-membership';
import { createCaseOwner } from '../../../app/resources/create-case-owner';
import * as CaseService from '../../../app/services/case-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction, OWNER_ACTIONS } from '../../../models/case-action';
import { CaseUser } from '../../../models/case-user';
import { DeaUser, DeaUserInput } from '../../../models/user';
import { caseUserResponseSchema } from '../../../models/validation/case-user';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

describe('create case owner resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createCaseOwnerTest');

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

  it('should create a membership with "owner" relevant permission(s) if does not exist', async () => {
    const deaCase: DeaCaseInput = {
      name: 'ThirteenSilverDollars',
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUserInput = {
      tokenId: 'arthurmorgan',
      idPoolId: 'arthurmorganidentityid',
      firstName: 'Arthur',
      lastName: 'Morgan',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: newCase.ulid,
      },
      body: JSON.stringify({
        userUlid: user.ulid,
        caseUlid: newCase.ulid,
      }),
    });

    const response = await createCaseOwner(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const createdOwnerMembership: CaseUser = jsonParseWithDates(response.body);

    Joi.assert(createdOwnerMembership, caseUserResponseSchema);
    expect(createdOwnerMembership.caseName).toEqual(deaCase.name);
    expect(createdOwnerMembership.userFirstName).toEqual(user.firstName);
    expect(createdOwnerMembership.userLastName).toEqual(user.lastName);
    expect(createdOwnerMembership.caseUlid).toEqual(newCase.ulid);
    expect(createdOwnerMembership.userUlid).toEqual(user.ulid);
    expect(createdOwnerMembership.actions).toEqual(OWNER_ACTIONS);
  });

  it('should update the membership with "owner" relevant permission(s) if does exist', async () => {
    const deaCase: DeaCaseInput = {
      name: 'AnotherCase',
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUserInput = {
      tokenId: 'arthurmorgan',
      idPoolId: 'arthurmorganidentityid',
      firstName: 'Arthur',
      lastName: 'Morgan',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

    // invite the user with "view" permissions only
    const eventViewOnly = getDummyEvent({
      pathParameters: {
        caseId: newCase.ulid,
      },
      body: JSON.stringify({
        userUlid: user.ulid,
        caseUlid: newCase.ulid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }),
    });

    const responseViewOnly = await createCaseMembership(eventViewOnly, dummyContext, repositoryProvider);

    expect(responseViewOnly.statusCode).toEqual(200);

    if (!responseViewOnly.body) {
      fail();
    }
    const createdMembershipViewOny: CaseUser = jsonParseWithDates(responseViewOnly.body);

    Joi.assert(createdMembershipViewOny, caseUserResponseSchema);
    expect(createdMembershipViewOny.caseName).toEqual(deaCase.name);
    expect(createdMembershipViewOny.userFirstName).toEqual(user.firstName);
    expect(createdMembershipViewOny.userLastName).toEqual(user.lastName);
    expect(createdMembershipViewOny.caseUlid).toEqual(newCase.ulid);
    expect(createdMembershipViewOny.userUlid).toEqual(user.ulid);
    expect(createdMembershipViewOny.actions).toEqual([CaseAction.VIEW_CASE_DETAILS]);

    // invite the user as owner, should update the existing membership
    const event = getDummyEvent({
      pathParameters: {
        caseId: newCase.ulid,
      },
      body: JSON.stringify({
        userUlid: user.ulid,
        caseUlid: newCase.ulid,
      }),
    });

    const response = await createCaseOwner(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const updatedToOwnerMembership: CaseUser = jsonParseWithDates(response.body);

    Joi.assert(updatedToOwnerMembership, caseUserResponseSchema);
    expect(updatedToOwnerMembership.caseName).toEqual(deaCase.name);
    expect(updatedToOwnerMembership.userFirstName).toEqual(user.firstName);
    expect(updatedToOwnerMembership.userLastName).toEqual(user.lastName);
    expect(updatedToOwnerMembership.caseUlid).toEqual(newCase.ulid);
    expect(updatedToOwnerMembership.userUlid).toEqual(user.ulid);
    expect(updatedToOwnerMembership.actions).toEqual(OWNER_ACTIONS);
  });

  it('should error if the path param is not provided', async () => {
    await expect(createCaseOwner(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });

  it('should error if no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: null,
    });

    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseOwner payload missing.'
    );
  });

  it('should error if payload does include valid JSON', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: {
        invalidJSON: 'invalidJSON',
        invalidJSON2: 'invalidJSON2',
      },
    });

    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseOwner payload is malformed. Failed to parse.'
    );
  });

  it('should error if the resource and path ids do not match', async () => {
    const ulid1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const ulid2 = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const ulid3 = '03ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: ulid1,
      },
      body: JSON.stringify({
        userUlid: ulid3,
        caseUlid: ulid2,
      }),
    });

    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case Ulid does not match resource'
    );
  });

  it('should error if the case does not exist', async () => {
    const deaUser: DeaUserInput = {
      tokenId: 'michahbell',
      idPoolId: 'micahbellidentityid',
      firstName: 'Micah',
      lastName: 'Bell',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

    const bogusUlid = '02ARZ3NDEKTSV4RRFFQ69G5FDV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
      body: JSON.stringify({
        userUlid: user.ulid,
        caseUlid: bogusUlid,
      }),
    });

    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Case with ulid ${bogusUlid} not found.`
    );
  });

  it('should error if the user does not exist', async () => {
    const deaUser: DeaUserInput = {
      tokenId: 'mickbell',
      idPoolId: 'mickbellidentityid',
      firstName: 'Mick',
      lastName: 'Bell',
    };
    const user = await UserService.createUser(deaUser, repositoryProvider);

    const deaCase: DeaCaseInput = {
      name: 'Bar Breaker',
    };
    const newCase = await CaseService.createCases(deaCase, user, repositoryProvider);

    const bogusUlid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: newCase.ulid,
      },
      body: JSON.stringify({
        userUlid: bogusUlid,
        caseUlid: newCase.ulid,
      }),
    });

    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
    await expect(createCaseOwner(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `User with ulid ${bogusUlid} not found.`
    );
  });
});
