/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import { S3Client, S3ClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import {
  STSClient,
  STSClientResolvedConfig,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import Joi from 'joi';
import { anyOfClass, instance, mock, when } from 'ts-mockito';
import { startCaseFileAudit } from '../../../app/resources/audit/start-case-file-audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  DATASETS_PROVIDER,
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
} from './case-file-integration-test-helper';

let caseId = '';
let fileId = '';
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes, S3ClientResolvedConfig>;
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;

describe('start case file audit', () => {
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

    modelProvider = await getTestRepositoryProvider('startCaseFileAuditIntegration');
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      datasetsProvider: DATASETS_PROVIDER,
    });

    const user = await callCreateUser(testProvider);

    caseId = (await callCreateCase(user, testProvider)).ulid ?? fail();

    fileId = (await callInitiateCaseFileUpload(user.ulid, testProvider, caseId, 'file1')).ulid ?? fail();
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
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await startCaseFileAudit(event, dummyContext, testProvider);

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
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startCaseFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
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
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startCaseFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'Could not find case'
    );
  });

  it('throws an error if case-file does not exist', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: 'hello',
    });

    const event = getDummyEvent({
      pathParameters: {
        caseId,
        fileId: bogusUlid,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startCaseFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'Could not find file'
    );
  });
});
