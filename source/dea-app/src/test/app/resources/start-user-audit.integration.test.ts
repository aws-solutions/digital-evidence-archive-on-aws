/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import Joi from 'joi';
import { anyOfClass, instance, mock, when } from 'ts-mockito';
import { startUserAudit } from '../../../app/resources/audit/start-user-audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

describe('start user audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  let userId: string;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('startUserAuditIntegration');
    const user = await createUser(
      {
        tokenId: '123',
        idPoolId: '123identityid',
        firstName: 'afirstname',
        lastName: 'alastname',
      },
      modelProvider
    );
    userId = user.ulid;
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with a queryId', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: 'a_query_id',
    });

    const event = getDummyEvent({
      pathParameters: {
        userId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await startUserAudit(event, dummyContext, testProvider);

    expect(result.statusCode).toEqual(200);
    const body: { auditId: string } = JSON.parse(result.body);
    Joi.assert(body.auditId, joiUlid);
  });

  it('throws an error if no queryId is returned', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: undefined,
    });

    const event = getDummyEvent({
      pathParameters: {
        userId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startUserAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'Unknown error starting Athena Query.'
    );
  });

  it('throws an error for an invalid user', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    const event = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startUserAudit(event, dummyContext, testProvider)).rejects.toThrow('Could not find user');
  });
});
