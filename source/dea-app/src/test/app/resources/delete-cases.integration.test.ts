/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { deleteCase } from '../../../app/resources/delete-cases';
import { getCase } from '../../../app/services/case-service';
import { createUser } from '../../../app/services/user-service';
import { DeaCase } from '../../../models/case';
import { CaseStatus } from '../../../models/case-status';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('delete cases resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('deleteCasesTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should respond with success if the target entity does not exist', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      }
    );

    const response = await deleteCase(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(204);
  });

  it('should successfully delete a case', async () => {
    const user = await createUser(
      {
        tokenId: 'mickybell',
        firstName: 'Micky',
        lastName: 'Bell',
      },
      repositoryProvider
    );

    const theCase: DeaCase = {
      name: 'ACaseForDeleting',
      status: CaseStatus.ACTIVE,
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);
    if (!createdCase.ulid) {
      fail();
    }

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        pathParameters: {
          caseId: createdCase.ulid,
        },
      }
    );

    const response = await deleteCase(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(204);

    const deletedCase = await getCase(createdCase.ulid, repositoryProvider);
    expect(deletedCase).toBeUndefined();
  });

  it('should error if the path param is not provided', async () => {
    await expect(deleteCase(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(ValidationError);
  });
});
