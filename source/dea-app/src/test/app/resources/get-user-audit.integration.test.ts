/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CloudWatchLogsClient, GetQueryResultsCommand, QueryStatus } from '@aws-sdk/client-cloudwatch-logs';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getUserAudit } from '../../../app/resources/get-user-audit';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { startAudit } from '../audit-test-support';

describe('get user audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  let userId: string;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('getUserAuditIntegration');
    const user = await createUser(
      {
        tokenId: '123',
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

  it('responds with csv data', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(GetQueryResultsCommand))).thenResolve({
      $metadata: {},
      status: QueryStatus.Complete,
      results: [
        [
          { field: 'fieldA', value: 'valueA' },
          { field: 'fieldB', value: 'valueB' },
        ],
        [
          { field: 'fieldA', value: 'valueA2' },
          { field: 'fieldB', value: 'valueB2' },
        ],
      ],
    });

    const expectedCSV = 'fieldA, fieldB\r\nvalueA, valueB\r\nvalueA2, valueB2\r\n';

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(expectedCSV);
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Running });

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Running');
  });

  it('returns complete with no data if data is not returned', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Complete });

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns complete with no data if data is empty', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({
      $metadata: {},
      status: QueryStatus.Complete,
      results: [],
    });

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns an error for an uknown user', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);

    const event = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
        auditId,
      },
    });
    await expect(
      getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance)
    ).rejects.toThrowError('Could not find user');
  });
});
