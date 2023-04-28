/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { deleteCase } from '../../../app/resources/delete-cases';
import { getCase } from '../../../app/services/case-service';
import { createCaseUserMembership } from '../../../app/services/case-user-service';
import { createUser } from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { CaseAction } from '../../../models/case-action';
import { createCase } from '../../../persistence/case';
import { listCaseUsersByCase } from '../../../persistence/case-user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
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
    const event = getDummyEvent({
      pathParameters: {
        caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
    });

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

    const theCase: DeaCaseInput = {
      name: 'ACaseForDeleting',
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
    });

    const response = await deleteCase(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(204);

    const deletedCase = await getCase(createdCase.ulid, repositoryProvider);
    expect(deletedCase).toBeUndefined();
  });

  it('should clean up memberships when the case is deleted', async () => {
    const user = await createUser(
      {
        tokenId: 'sadieadler',
        firstName: 'Sadie',
        lastName: 'Adler',
      },
      repositoryProvider
    );

    const theCase: DeaCaseInput = {
      name: 'ACaseWithMemberships',
      description: 'An initial description',
    };

    const createdCase = await createCase(theCase, user, repositoryProvider);

    //create so many memberships
    for (let i = 0; i < 28; ++i) {
      const user = await createUser(
        {
          tokenId: `sadieadler${i}`,
          firstName: `Sadie${i}`,
          lastName: `Adler${i}`,
        },
        repositoryProvider
      );

      await createCaseUserMembership(
        {
          caseUlid: createdCase.ulid,
          userUlid: user.ulid,
          actions: [CaseAction.VIEW_CASE_DETAILS],
          userFirstName: user.firstName,
          userLastName: user.lastName,
          caseName: theCase.name,
        },
        repositoryProvider
      );
    }

    const usersOnCase = await listCaseUsersByCase(createdCase.ulid, 30, undefined, repositoryProvider);
    expect(usersOnCase.length).toEqual(29);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
    });

    const response = await deleteCase(event, dummyContext, repositoryProvider);

    // All memberships should be gone
    const usersOnCaseAfterDelete = await listCaseUsersByCase(
      createdCase.ulid,
      30,
      undefined,
      repositoryProvider
    );
    expect(usersOnCaseAfterDelete.length).toEqual(0);

    expect(response.statusCode).toEqual(204);

    const deletedCase = await getCase(createdCase.ulid, repositoryProvider);
    expect(deletedCase).toBeUndefined();
  }, 30000);

  it('should error if the path param is not provided', async () => {
    await expect(deleteCase(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });
});
