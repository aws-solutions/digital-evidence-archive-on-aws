/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import BaseAuditPlugin from '@aws/workbench-core-audit/lib/plugins/baseAuditPlugin';
import { anyOfClass, instance, mock, verify } from 'ts-mockito';
import DeaAuditWriter from '../../app/audit/dea-audit-writer';
import {
  AuditEventResult,
  AuditEventSource,
  AuditEventType,
  auditService,
  DeaAuditService,
  IdentityType,
} from '../../app/services/audit-service';

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
    const auditplugin = new BaseAuditPlugin(writer);
    const testAuditService = new DeaAuditService(auditplugin, true, [], []);

    await testAuditService.writeCJISCompliantEntry({
      dateTime: new Date().toISOString(),
      requestPath: '/',
      sourceComponent: AuditEventSource.API_GATEWAY,
      eventType: AuditEventType.CREATE_CASE,
      actorIdentity: { idType: IdentityType.COGNITO_ID, id: 'identifier', sourceIp: '123' },
      result: AuditEventResult.SUCCESS,
    });
    verify(clientMock.send(anyOfClass(CreateLogStreamCommand)));
    verify(clientMock.send(anyOfClass(PutLogEventsCommand)));
  });

  it('exists', () => {
    expect(auditService).toBeDefined();
    expect('write' in auditService).toBeTruthy();
    expect('writeCJISCompliantEntry' in auditService).toBeTruthy();
  });
});
