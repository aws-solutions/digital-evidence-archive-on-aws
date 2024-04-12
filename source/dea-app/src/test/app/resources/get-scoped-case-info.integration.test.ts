/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { getScopedCaseInformation } from '../../../app/resources/get-scoped-case-information';
import { createUser } from '../../../app/services/user-service';
import { DeaCaseInput } from '../../../models/case';
import { scopedCaseResponseSchema } from '../../../models/validation/case';
import { createCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let testProviders: LambdaProviders;

describe('get scoped case info resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getScopedCaseInfo');
    testProviders = createTestProvidersObject({ repositoryProvider });
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should retrieve a case', async () => {
    const user = await createUser(
      {
        tokenId: 'creator',
        idPoolId: 'caseowneridentityid',
        firstName: 'Create',
        lastName: 'Case',
      },
      repositoryProvider
    );

    const theCase: DeaCaseInput = {
      name: 'ACaseForRetrieving',
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);

    const event = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
    });

    const response = await getScopedCaseInformation(event, dummyContext, testProviders);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const retrievedCase: { name: string; ulid: string } = JSON.parse(response.body);

    Joi.assert(retrievedCase, scopedCaseResponseSchema);
    expect(retrievedCase.ulid).toEqual(createdCase.ulid);
    expect(retrievedCase.name).toEqual(theCase.name);
  });

  it('should throw an error if the requested case does not exist', async () => {
    const ulid = '02ARZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: ulid,
      },
    });

    await expect(getScopedCaseInformation(event, dummyContext, testProviders)).rejects.toThrow(NotFoundError);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getScopedCaseInformation(getDummyEvent(), dummyContext, testProviders)).rejects.toThrow(
      ValidationError
    );
  });
});
