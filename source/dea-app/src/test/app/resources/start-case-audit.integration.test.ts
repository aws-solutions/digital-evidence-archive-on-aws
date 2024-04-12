/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import Joi from 'joi';
import { anyOfClass, instance, mock, when } from 'ts-mockito';
import { startCaseAudit } from '../../../app/resources/audit/start-case-audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callCreateCase, callCreateUser } from './case-file-integration-test-helper';

let caseId = '';

describe('start case audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('startCaseAuditIntegration');
    const testProvider = createTestProvidersObject({ repositoryProvider: modelProvider });

    const user = await callCreateUser(testProvider);
    caseId = (await callCreateCase(user, testProvider)).ulid ?? fail();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
    process.env.TRAIL_LOG_GROUP_NAME = 'TESTTRAILGROUP';
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
        caseId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await startCaseAudit(event, dummyContext, testProvider);

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
        caseId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startCaseAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'Unknown error starting Athena Query.'
    );
  });

  it('throws an error if case does not exist', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: 'hello',
    });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startCaseAudit(event, dummyContext, testProvider)).rejects.toThrow('Could not find case');
  });
});
