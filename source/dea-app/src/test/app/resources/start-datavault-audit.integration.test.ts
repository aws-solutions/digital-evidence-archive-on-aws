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
import { startDataVaultAudit } from '../../../app/resources/audit/start-datavault-audit';
import { joiUlid } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callCreateDataVault } from './data-vault-integration-test-helper';

let dataVaultId = '';
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;

describe('start datavault audit', () => {
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

    modelProvider = await getTestRepositoryProvider('startDataVaultAuditIntegration');

    dataVaultId = (await callCreateDataVault(modelProvider, 'aDataVault', 'description')).ulid ?? fail();
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
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    const result = await startDataVaultAudit(event, dummyContext, testProvider);

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
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startDataVaultAudit(event, dummyContext, testProvider)).rejects.toThrow(
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
      },
    });
    const testProvider = createTestProvidersObject({
      repositoryProvider: modelProvider,
      athenaClient: clientMockInstance,
    });
    await expect(startDataVaultAudit(event, dummyContext, testProvider)).rejects.toThrow(
      'DataVault not found.'
    );
  });
});
