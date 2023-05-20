/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { createCaseMembership } from '../../../app/resources/create-case-membership';
import * as CaseService from '../../../app/services/case-service';
import * as UserService from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
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

describe('create case membership resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createCaseMembershipTest');

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

  it('should create a user-case membership', async () => {
    const deaCase: DeaCaseInput = {
      name: 'ThirteenSilverDollars',
    };
    const newCase = await CaseService.createCases(deaCase, caseOwner, repositoryProvider);

    // user to be invited
    const deaUser: DeaUserInput = {
      tokenId: 'arthurmorgan',
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
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }),
    });

    const response = await createCaseMembership(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const createdMembership: CaseUser = jsonParseWithDates(response.body);

    Joi.assert(createdMembership, caseUserResponseSchema);
    expect(createdMembership.caseName).toEqual(deaCase.name);
    expect(createdMembership.userFirstName).toEqual(user.firstName);
    expect(createdMembership.userLastName).toEqual(user.lastName);
    expect(createdMembership.caseUlid).toEqual(newCase.ulid);
    expect(createdMembership.userUlid).toEqual(user.ulid);
    expect(createdMembership.actions).toEqual([CaseAction.VIEW_CASE_DETAILS]);
  });

  it('should error if the path param is not provided', async () => {
    await expect(createCaseMembership(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
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

    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseUser payload missing.'
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

    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'CaseUser payload is malformed. Failed to parse.'
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
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }),
    });

    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case Ulid does not match resource'
    );
  });

  it('should error if the case does not exist', async () => {
    const deaUser: DeaUserInput = {
      tokenId: 'michahbell',
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
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }),
    });

    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      NotFoundError
    );
    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Case with ulid ${bogusUlid} not found.`
    );
  });

  it('should error if the user does not exist', async () => {
    const deaUser: DeaUserInput = {
      tokenId: 'mickbell',
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
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }),
    });

    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      NotFoundError
    );
    await expect(createCaseMembership(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `User with ulid ${bogusUlid} not found.`
    );
  });
});
