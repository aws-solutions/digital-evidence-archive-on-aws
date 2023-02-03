/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { OneTableError } from 'dynamodb-onetable';
import Joi from 'joi';
import { updateCases } from '../../../app/resources/update-cases';
import { DeaCase } from '../../../models/case';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { caseResponseSchema } from '../../../models/validation/case';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from './get-test-repository';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

describe('update cases resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('updateCaseTest');

    caseOwner = (await createUser(
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

  it('should successfully update a case description and name', async () => {
    const updatedDescription = 'An Updated Description';
    const updatedName = 'AnUpdatedCase';
    const theCase: DeaCase = {
      name: 'ACaseForUpdating',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase.ulid,
          name: updatedName,
          description: updatedDescription,
        }),
      }
    );

    const response = await updateCases(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const updatedCase: DeaCase = jsonParseWithDates(response.body);

    Joi.assert(updatedCase, caseResponseSchema);
    if (!updatedCase.updated || !createdCase.updated) {
      fail();
    }

    expect(updatedCase.updated.getTime()).toBeGreaterThan(createdCase.updated.getTime());
    expect(updatedCase).toEqual({
      ...createdCase,
      name: updatedName,
      updated: updatedCase.updated,
      description: updatedDescription,
    });
  });

  it('should error if path and payload do not match', async () => {
    const ulid1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const ulid2 = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: ulid1,
        },
        body: JSON.stringify({
          ulid: ulid2,
          name: 'ThisWillNotWork',
          description: 'these are words',
        }),
      }
    );

    expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Requested Case Ulid does not match resource'
    );
  });

  it('should error if no payload is provided', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
        body: undefined,
      }
    );

    expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Update cases payload missing.'
    );
  });

  it('should error if a path parameter specifying caseId is not found', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          ulid: ulid,
          name: 'ThisWillNotWork',
          description: 'these are words',
        }),
      }
    );

    await expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'caseId' is missing."
    );
  });

  it('should not allow update of status', async () => {
    const theCase: DeaCase = {
      name: 'CaseStatusCheck',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase.ulid,
          name: 'CaseStatusCheck',
          status: createdCase.status,
          description: 'description',
        }),
      }
    );

    await expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      '"status" is not allowed'
    );
  });

  it('should not allow update of objectCount', async () => {
    const theCase: DeaCase = {
      name: 'CaseCountCheck',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase.ulid,
          name: 'CaseCountCheck',
          objectCount: 5,
          description: 'description',
        }),
      }
    );

    await expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      '"objectCount" is not allowed'
    );
  });

  it('should error when updating a non-existant record', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: ulid,
        },
        body: JSON.stringify({
          ulid: ulid,
          name: 'ThisWillNotWork',
          description: 'these are words',
        }),
      }
    );

    await expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(OneTableError);
  });

  it('should error when updating to a name in use', async () => {
    const theCase1: DeaCase = {
      name: 'TheFirstCase',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const theCase2: DeaCase = {
      name: 'TheSecondCase',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase1 = await createCase(theCase1, caseOwner, repositoryProvider);
    const createdCase2 = await createCase(theCase2, caseOwner, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase1.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase1.ulid,
          name: createdCase2.name,
          description: 'whatevs',
        }),
      }
    );

    await expect(updateCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Cannot update unique attributes "name" for "Case". An item of the same name already exists.'
    );
  });

  it('should update succesfully to a name that was previously, but is no longer in use', async () => {
    const aNewNameForCase1 = 'TheFirstCaseButMore';
    const theCase1: DeaCase = {
      name: 'TheFirstCaseA',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const theCase2: DeaCase = {
      name: 'TheSecondCaseB',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase1 = await createCase(theCase1, caseOwner, repositoryProvider);
    const createdCase2 = await createCase(theCase2, caseOwner, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase1.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase1.ulid,
          name: aNewNameForCase1,
          description: 'whatevs',
        }),
      }
    );

    const response = await updateCases(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const updatedCase1: DeaCase = jsonParseWithDates(response.body);
    expect(updatedCase1.name).toEqual(aNewNameForCase1);

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase2.ulid,
        },
        body: JSON.stringify({
          ulid: createdCase2.ulid,
          name: theCase1.name,
          description: 'whatevs',
        }),
      }
    );

    const response2 = await updateCases(event2, dummyContext, repositoryProvider);

    expect(response2.statusCode).toEqual(200);

    if (!response2.body) {
      fail();
    }

    const updatedCase2: DeaCase = jsonParseWithDates(response2.body);
    expect(updatedCase2.name).toEqual(theCase1.name);
  });
});
