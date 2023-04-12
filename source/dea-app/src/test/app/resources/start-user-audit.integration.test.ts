/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { anything, instance, mock, when } from 'ts-mockito';
import { startUserAudit } from '../../../app/resources/start-user-audit';
import { bogusUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';

describe('start user audit', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responds with a queryId', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, queryId: 'a_query_id' });

    const event = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
      },
    });
    const result = await startUserAudit(event, dummyContext, undefined, undefined, clientMockInstance);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('a_query_id');
  });

  it('throws an error if no queryId is returned', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    when(clientMock.send(anything())).thenResolve({ $metadata: {}, queryId: undefined });

    const event = getDummyEvent({
      pathParameters: {
        userId: bogusUlid,
      },
    });
    await expect(
      startUserAudit(event, dummyContext, undefined, undefined, clientMockInstance)
    ).rejects.toThrow('Unknown error starting Cloudwatch Logs Query.');
  });
});
