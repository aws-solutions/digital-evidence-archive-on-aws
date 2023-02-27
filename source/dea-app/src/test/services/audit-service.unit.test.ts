/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { anyOfClass, instance, mock, verify } from 'ts-mockito';
import DeaAuditWriter from '../../app/audit/dea-audit-writer';
import { auditService } from '../../app/services/audit-service';

describe('audit service', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('writes', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    const clientMockInstance = instance(clientMock);
    const writer = new DeaAuditWriter(clientMockInstance);

    await writer.write({ tag: 'youre it' }, { action: 'create', actor: { name: 'Mickey' } });
    verify(clientMock.send(anyOfClass(CreateLogStreamCommand)));
    verify(clientMock.send(anyOfClass(PutLogEventsCommand)));
  });

  it('exists', () => {
    expect(auditService).toBeDefined();
    expect('write' in auditService).toBeTruthy();
  });
});
