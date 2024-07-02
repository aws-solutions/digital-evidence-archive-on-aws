/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { AthenaClient, GetQueryExecutionCommand, QueryExecutionState } from '@aws-sdk/client-athena';
import { S3Client, S3ClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import {
  STSClient,
  STSClientResolvedConfig,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { anyOfClass, anything, instance, mock, when } from 'ts-mockito';
import { getDataVaultAudit } from '../../../app/resources/audit/get-datavault-audit';
import { AuditResult } from '../../../app/services/audit-service';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { getQueryResponseWithState, startAudit } from '../audit-test-support';
import { callCreateDataVault } from './data-vault-integration-test-helper';

let dataVaultId = '';
let athenaMock;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes, S3ClientResolvedConfig>;
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;

describe('get datavault audit', () => {
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

    modelProvider = await getTestRepositoryProvider('getDATAVAULTIntegration');

    dataVaultId =
      (await callCreateDataVault(modelProvider, 'GetDVFile', 'Get dvfile integration')).ulid ?? fail();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_DOWNLOAD_ROLE_ARN = 'AUDIT_DOWNLOAD_ROLE_ARN';
    process.env.AWS_PARTITION = 'aws';
    process.env.AWS_REGION = 'eu-west-1';
    process.env.KEY_ARN = 'keyarn';
    process.env.SOURCE_IP_MASK_CIDR = '32';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with download url', async () => {
    const auditId = await startAudit(AuditType.DATAVAULT, `${dataVaultId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(GetQueryExecutionCommand))).thenResolve(
      getQueryResponseWithState(QueryExecutionState.SUCCEEDED)
    );

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId,
        auditId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await getDataVaultAudit(event, dummyContext, testProvider);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('"status":"SUCCEEDED"');
    expect(result.body).toContain('"downloadUrl":"https://test-bucket.s3');
  });

  it('returns status if not complete', async () => {
    const auditId = await startAudit(AuditType.DATAVAULT, `${dataVaultId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve(getQueryResponseWithState(QueryExecutionState.RUNNING));

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId,
        auditId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await getDataVaultAudit(event, dummyContext, testProvider);
    expect(result.statusCode).toEqual(200);
    const responseBody: AuditResult = JSON.parse(result.body);
    expect(responseBody.status).toEqual(QueryExecutionState.RUNNING.valueOf());
  });

  it('returns unknown status if the status is not provided', async () => {
    const auditId = await startAudit(AuditType.DATAVAULT, `${dataVaultId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId,
        auditId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await getDataVaultAudit(event, dummyContext, testProvider);
    expect(result.statusCode).toEqual(200);
    const responseBody: AuditResult = JSON.parse(result.body);
    expect(responseBody.status).toEqual('Unknown');
    expect(responseBody.downloadUrl).toBeUndefined();
  });

  it('throws an error if datavault does not exist', async () => {
    const auditId = await startAudit(AuditType.DATAVAULT, `${dataVaultId}`, modelProvider);
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {} });

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: bogusUlid,
        auditId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(getDataVaultAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'DataVault not found.'
    );
  });
});
