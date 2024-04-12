/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import {
  STSClient,
  STSClientResolvedConfig,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import Joi from 'joi';
import { anyOfClass, instance, mock, when } from 'ts-mockito';
import { startDataVaultFileAudit } from '../../../app/resources/audit/start-datavault-file-audit';
import { DataVaultFileDTO } from '../../../models/data-vault-file';
import { joiUlid } from '../../../models/validation/joi-common';
import { createDataVaultFile } from '../../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callCreateUser } from './case-file-integration-test-helper';
import { callCreateDataVault } from './data-vault-integration-test-helper';

let dataVaultId = '';
let fileId = '';
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;

describe('start datavault file audit', () => {
  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });

    modelProvider = await getTestRepositoryProvider('startDataVaultFileAuditIntegration');

    const user = await callCreateUser(createTestProvidersObject({ repositoryProvider: modelProvider }));

    dataVaultId = (await callCreateDataVault(modelProvider, 'aDataVault', 'description')).ulid ?? fail();

    const fileInput: DataVaultFileDTO = {
      fileName: 'testFile',
      filePath: '/dummypath/test/test/',
      dataVaultUlid: dataVaultId,
      isFile: true,
      fileSizeBytes: 1024,
      createdBy: user.ulid,
      contentType: 'regular',
      sha256Hash: 'SHA256HASH',
      versionId: 'VERSIONID',
      fileS3Key: 'S3KEY',
      executionId: 'exec-00000000000000000',
    };

    const dataVaultFile = (await createDataVaultFile([fileInput], modelProvider))[0];
    fileId = dataVaultFile.ulid;
  });

  beforeEach(() => {
    jest.resetModules();
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
        dataVaultId,
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await startDataVaultFileAudit(event, dummyContext, testProvider);

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
        dataVaultId,
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startDataVaultFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'Unknown error starting Athena Query.'
    );
  });

  it('throws an error if vault does not exist', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: 'hello',
    });

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId: bogusUlid,
        fileId,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startDataVaultFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'DataVault not found.'
    );
  });

  it('throws an error if vault-file does not exist', async () => {
    const clientMock: AthenaClient = mock(AthenaClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anyOfClass(StartQueryExecutionCommand))).thenResolve({
      $metadata: {},
      QueryExecutionId: 'hello',
    });

    const event = getDummyEvent({
      pathParameters: {
        dataVaultId,
        fileId: bogusUlid,
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startDataVaultFileAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'DataVault File not found.'
    );
  });
});
