/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getCase } from '../../../app/resources/get-case-details';
import { createUser } from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { CaseStatus } from '../../../models/case-status';
import { caseResponseSchema } from '../../../models/validation/case';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('get case details resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getCaseDetailsTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should retrieve a case', async () => {
    const user = await createUser(
      {
        tokenId: 'creator',
        firstName: 'Create',
        lastName: 'Case',
      },
      repositoryProvider
    );

    const theCase: DeaCase = {
      name: 'ACaseForRetrieving',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase.ulid,
        },
      }
    );

    const response = await getCase(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const retrievedCase: DeaCase = jsonParseWithDates(response.body);

    Joi.assert(retrievedCase, caseResponseSchema);
    expect(retrievedCase.ulid).toEqual(createdCase.ulid);
    expect(retrievedCase.name).toEqual(theCase.name);
    expect(retrievedCase.status).toEqual(theCase.status);
    expect(retrievedCase.description).toEqual(theCase.description);
  });

  it('should throw an error if the requested case does not exist', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: ulid,
        },
      }
    );

    await expect(getCase(event, dummyContext, repositoryProvider)).rejects.toThrow(NotFoundError);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getCase(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(ValidationError);
  });
});
