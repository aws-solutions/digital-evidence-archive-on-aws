/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient, GetQueryExecutionCommand, QueryExecutionState } from '@aws-sdk/client-athena';
import {
  STSClient,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getSystemAudit } from '../../../app/resources/get-system-audit';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { getQueryResponseWithState, startAudit } from '../audit-test-support';

describe('get system audit', () => {
  const OLD_ENV = process.env;
  let stsMock: AwsStub<STSInputs, STSOutputs>;

  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('getSystemAuditIntegration');
    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });
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

  it('responds with csv data', async () => {
    const auditId = await startAudit(AuditType.SYSTEM, 'SYSTEM', modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(GetQueryExecutionCommand))).thenResolve(
      getQueryResponseWithState(QueryExecutionState.SUCCEEDED)
    );

    const event = getDummyEvent({
      pathParameters: {
        auditId,
      },
    });
    const result = await getSystemAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('"status":"SUCCEEDED"');
    expect(result.body).toContain('"downloadUrl":"https://test-bucket.s3');
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.SYSTEM, 'SYSTEM', modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve(getQueryResponseWithState(QueryExecutionState.RUNNING));

    const event = getDummyEvent({
      pathParameters: {
        auditId,
      },
    });
    const result = await getSystemAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual(QueryExecutionState.RUNNING.valueOf());
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.SYSTEM, 'SYSTEM', modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        auditId,
      },
    });
    const result = await getSystemAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string; csvFormattedData: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.csvFormattedData).toBeUndefined();
  });
});
