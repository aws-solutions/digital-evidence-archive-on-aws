/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { updateCaseStatus } from '../../../app/resources/update-case-status';
import { DeaCase, DeaCaseInput } from '../../../models/case';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { caseResponseSchema } from '../../../models/validation/case';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createCase, updateCaseStatus as updateCaseStatusInDb } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { checkApiSucceeded } from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

describe('update case status', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('updateCaseStatusTest');

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

  it('should successfully inactivate case', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForUpdating',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    const response = await updateCaseStatus(event, dummyContext, repositoryProvider);
    checkApiSucceeded(response);

    const updatedCase: DeaCase = jsonParseWithDates(response.body);

    Joi.assert(updatedCase, caseResponseSchema);
    if (!updatedCase.updated || !createdCase.updated) {
      fail();
    }

    expect(updatedCase.updated.getTime()).toBeGreaterThan(createdCase.updated.getTime());
    expect(updatedCase).toEqual({
      ...createdCase,
      status: CaseStatus.INACTIVE,
      updated: updatedCase.updated,
      filesStatus: CaseFileStatus.DELETING,
    });
  });

  it('should activate inactive case', async () => {
    const theCase: DeaCaseInput = {
      name: 'InactiveToActive',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    // update case status to inactive directly in DB
    await updateCaseStatusInDb(createdCase, CaseStatus.INACTIVE, CaseFileStatus.DELETED, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: false,
        status: CaseStatus.ACTIVE,
      }),
    });

    const response = await updateCaseStatus(event, dummyContext, repositoryProvider);
    checkApiSucceeded(response);

    const updatedCase: DeaCase = jsonParseWithDates(response.body);

    Joi.assert(updatedCase, caseResponseSchema);
    if (!updatedCase.updated || !createdCase.updated) {
      fail();
    }

    expect(updatedCase.updated.getTime()).toBeGreaterThan(createdCase.updated.getTime());
    expect(updatedCase).toEqual({
      ...createdCase,
      status: CaseStatus.ACTIVE,
      updated: updatedCase.updated,
      filesStatus: CaseFileStatus.ACTIVE,
    });
  });

  it('should not activate case that is deleting files', async () => {
    const theCase: DeaCaseInput = {
      name: 'ActivateFailWhenDeleting',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const inactivateEvent = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    const response = await updateCaseStatus(inactivateEvent, dummyContext, repositoryProvider);
    checkApiSucceeded(response);

    const activateEvent = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: false,
        status: CaseStatus.ACTIVE,
      }),
    });
    await expect(updateCaseStatus(activateEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      "Case status can't be changed to ACTIVE when its files are being deleted"
    );
  });

  it('idempotency inactive to inactive', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForTestingDeleteIdempotency',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    // update case status. expect updated case
    const updateResponse = await updateCaseStatus(event, dummyContext, repositoryProvider);
    checkApiSucceeded(updateResponse);
    const updatedCase: DeaCase = jsonParseWithDates(updateResponse.body);

    // update case status again. expect case without updates
    const noUpdateResponse = await updateCaseStatus(event, dummyContext, repositoryProvider);
    checkApiSucceeded(noUpdateResponse);
    const notUpdatedCase: DeaCase = jsonParseWithDates(noUpdateResponse.body);

    Joi.assert(updatedCase, caseResponseSchema);
    Joi.assert(notUpdatedCase, caseResponseSchema);
    if (!updatedCase.updated || !createdCase.updated || !notUpdatedCase.updated) {
      fail();
    }

    console.log(updatedCase);
    console.log(notUpdatedCase);
    // make sure case was updated first time
    expect(updatedCase.updated.getTime()).toBeGreaterThan(createdCase.updated.getTime());

    // make sure case wasn't updated second time
    expect(notUpdatedCase.updated.getTime()).not.toBeGreaterThan(updatedCase.updated.getTime());
    expect(updatedCase.updated.getTime()).toBeCloseTo(notUpdatedCase.updated.getTime());
  });

  it('No op when requesting to activate active case', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForTestingNoOp',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: false,
        status: CaseStatus.ACTIVE,
      }),
    });

    // update case status. expect updated case
    const response = await updateCaseStatus(event, dummyContext, repositoryProvider);
    checkApiSucceeded(response);
    const notUpdatedCase: DeaCase = jsonParseWithDates(response.body);

    Joi.assert(notUpdatedCase, caseResponseSchema);
    if (!createdCase.updated || !notUpdatedCase.updated) {
      fail();
    }

    // make sure case wasn't updated
    expect(notUpdatedCase.updated.getTime()).not.toBeGreaterThan(createdCase.updated.getTime());
    expect(notUpdatedCase.updated.getTime()).toBeCloseTo(createdCase.updated.getTime());
  });

  it('should fail if delete-file requested when activating case', async () => {
    const theCase: DeaCaseInput = {
      name: 'Failed delete case',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
      body: JSON.stringify({
        name: createdCase.name,
        deleteFiles: true,
        status: CaseStatus.ACTIVE,
      }),
    });
    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Delete files can only be requested when inactivating a case'
    );
  });

  it('should error if no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: null,
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Update case status payload missing.'
    );
  });

  it('should error if caseId is not provided', async () => {
    const event = getDummyEvent({
      body: JSON.stringify({
        name: 'hello',
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'caseId' is missing."
    );
  });

  it('should error if caseId does not exist in DB', async () => {
    const ulid = 'FAKEZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: ulid,
      },
      body: JSON.stringify({
        name: 'hello',
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Could not find case: hello'
    );
  });
});
