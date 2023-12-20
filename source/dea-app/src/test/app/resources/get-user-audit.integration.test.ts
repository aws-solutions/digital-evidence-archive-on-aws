/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AthenaClient, GetQueryExecutionCommand, QueryExecutionState } from '@aws-sdk/client-athena';
import { STSClient } from '@aws-sdk/client-sts';
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getUserAudit } from '../../../app/resources/audit/get-user-audit';
import { AuditResult } from '../../../app/services/audit-service';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { getQueryResponseWithState, startAudit } from '../audit-test-support';

describe('get user audit', () => {
  const OLD_ENV = process.env;
  let stsMock: AwsClientStub<STSClient>;

  let modelProvider: ModelRepositoryProvider;
  let userId: string;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('getUserAuditIntegration');
    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });
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
    process.env.AUDIT_DOWNLOAD_ROLE_ARN = 'AUDIT_DOWNLOAD_ROLE_ARN';
    process.env.AWS_REGION = 'eu-west-1';
    process.env.AWS_PARTITION = 'aws';
    process.env.KEY_ARN = 'keyarn';
    process.env.SOURCE_IP_MASK_CIDR = '32';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with a download url', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(GetQueryExecutionCommand))).thenResolve(
      getQueryResponseWithState(QueryExecutionState.SUCCEEDED)
    );

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('"status":"SUCCEEDED"');
    expect(result.body).toContain('"downloadUrl":"https://test-bucket.s3');
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve(getQueryResponseWithState(QueryExecutionState.RUNNING));

    const event = getDummyEvent({
      pathParameters: {
        userId,
        auditId,
      },
    });
    const result = await getUserAudit(event, dummyContext, modelProvider, undefined, clientMockInstance);
    expect(result.statusCode).toEqual(200);
    const responseBody: { status: string } = JSON.parse(result.body);
    expect(responseBody.status).toEqual(QueryExecutionState.RUNNING.valueOf());
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
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
    const responseBody: AuditResult = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.downloadUrl).toBeUndefined();
  });

  it('returns an error for an uknown user', async () => {
    const auditId = await startAudit(AuditType.USER, userId, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
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
