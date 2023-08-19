/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { AthenaClient, GetQueryExecutionCommand, QueryExecutionState } from '@aws-sdk/client-athena';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import {
  STSClient,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getCaseFileAudit } from '../../../app/resources/get-case-file-audit';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { getQueryResponseWithState, startAudit } from '../audit-test-support';
import {
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
} from './case-file-integration-test-helper';

let caseId = '';
let fileId = '';
let athenaMock;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let stsMock: AwsStub<STSInputs, STSOutputs>;

describe('get case file audit', () => {
  const OLD_ENV = process.env;

  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: 'hi',
      VersionId: 'hello',
    });

    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });

    athenaMock = mockClient(AthenaClient);
    athenaMock.resolves({
      QueryExecutionId: 'a_query_id',
      QueryExecution: {
        Status: {
          State: 'SUCCEEDED',
        },
      },
    });

    modelProvider = await getTestRepositoryProvider('getCaseFileAuditIntegration');

    const user = await callCreateUser(modelProvider);

    caseId = (await callCreateCase(user, modelProvider)).ulid ?? fail();

    fileId = (await callInitiateCaseFileUpload(user.ulid, modelProvider, caseId, 'file1')).ulid ?? fail();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
    process.env.TRAIL_LOG_GROUP_NAME = 'TESTTRAILGROUP';
    process.env.AUDIT_DOWNLOAD_ROLE_ARN = 'AUDIT_DOWNLOAD_ROLE_ARN';
    process.env.AWS_REGION = 'eu-west-1';
    process.env.KEY_ARN = 'keyarn';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with download url', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(GetQueryExecutionCommand))).thenResolve(
      getQueryResponseWithState(QueryExecutionState.SUCCEEDED)
    );

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId,
        auditId,
      },
    });
    const result = await getCaseFileAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('"status":"SUCCEEDED"');
    expect(result.body).toContain('"downloadUrl":"https://test-bucket.s3');
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve(getQueryResponseWithState(QueryExecutionState.RUNNING));

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
    expect(responseBody.status).toEqual(QueryExecutionState.RUNNING.valueOf());
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.CASEFILE, `${caseId}${fileId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
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
    const clientMock: AthenaClient = mock(AthenaClient);
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
    const clientMock: AthenaClient = mock(AthenaClient);
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
