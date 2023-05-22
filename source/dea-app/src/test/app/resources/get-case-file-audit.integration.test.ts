/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { CloudWatchLogsClient, GetQueryResultsCommand, QueryStatus } from '@aws-sdk/client-cloudwatch-logs';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getCaseFileAudit } from '../../../app/resources/get-case-file-audit';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { startAudit } from '../audit-test-support';
import {
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
} from './case-file-integration-test-helper';

let caseId = '';
let fileId = '';
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;

describe('get case file audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: 'hi',
      VersionId: 'hello',
    });

    modelProvider = await getTestRepositoryProvider('getCaseFileAuditIntegration');

    const user = await callCreateUser(modelProvider);

    caseId = (await callCreateCase(user, modelProvider)).ulid ?? fail();

    const event = getDummyEvent();
    event.headers['userUlid'] = user.ulid;
    fileId = (await callInitiateCaseFileUpload(event, modelProvider, caseId, 'file1')).ulid ?? fail();
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

  it('responds with csv data', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
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
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(expectedCSV);
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Running });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Running');
  });

  it('returns complete with no data if data is not returned', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, status: QueryStatus.Complete });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns complete with no data if data is empty', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({
      $metadata: {},
      status: QueryStatus.Complete,
      results: [],
    });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Complete');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });

  it('throws an error if case does not exist', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
        fileId,
        auditId,
      },
    });
    await expect(
      getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance)
    ).rejects.toThrow('Could not find case');
  });

  it('throws an error if case-file does not exist', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId: bogusUlid,
        auditId,
      },
    });
    await expect(
      getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance)
    ).rejects.toThrow('Could not find file');
  });
});
