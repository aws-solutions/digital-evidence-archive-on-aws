/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import Joi from 'joi';
import { anyOfClass, instance, mock, when } from 'ts-mockito';
import { startSystemAudit } from '../../../app/resources/audit/start-system-audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

describe('start system audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('startSystemAuditIntegration');
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

    const event = getDummyEvent();
    const result = await startSystemAudit(
      event,
      dummyContext,
      modelProvider,
      undefined,
      undefined,
      clientMockInstance
    );

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

    const event = getDummyEvent();
    await expect(
      startSystemAudit(event, dummyContext, modelProvider, undefined, undefined, clientMockInstance)
    ).rejects.toThrow('Unknown error starting Athena Query.');
  });
});
