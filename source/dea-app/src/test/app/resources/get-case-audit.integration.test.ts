/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CloudWatchLogsClient, GetQueryResultsCommand, QueryStatus } from '@aws-sdk/client-cloudwatch-logs';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getCaseAudit } from '../../../app/resources/get-case-audit';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';

describe('start case audit', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with csv data', async () => {
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
        caseId: bogusUlid,
        auditId: '11111111-1111-1111-1111-111111111111',
      },
    });
    const result = await getCaseAudit(event, dummyContext, undefined, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(expectedCSV);
  });

  it('returns status if not complete', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Running });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        auditId: '11111111-1111-1111-1111-111111111111',
      },
    });
    const result = await getCaseAudit(event, dummyContext, undefined, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Running');
  });

  it('returns complete with no data if data is not returned', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Complete });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        auditId: '11111111-1111-1111-1111-111111111111',
      },
    });
    const result = await getCaseAudit(event, dummyContext, undefined, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns complete with no data if data is empty', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({
      $metadata: {},
      status: QueryStatus.Complete,
      results: [],
    });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        auditId: '11111111-1111-1111-1111-111111111111',
      },
    });
    const result = await getCaseAudit(event, dummyContext, undefined, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns unknown status if the status is not provided', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        auditId: '11111111-1111-1111-1111-111111111111',
      },
    });
    const result = await getCaseAudit(event, dummyContext, undefined, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });
});
