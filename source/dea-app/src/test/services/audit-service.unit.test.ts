/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import BaseAuditPlugin from '@aws/workbench-core-audit/lib/plugins/baseAuditPlugin';
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { anyOfClass, instance, mock, verify, when } from 'ts-mockito';
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
    when(clientMock.send(anyOfClass(PutLogEventsCommand))).thenResolve({
      $metadata: { httpStatusCode: 200 },
    });
    const clientMockInstance = instance(clientMock);
    const writer = new DeaAuditWriter(clientMockInstance);
    const auditplugin = new BaseAuditPlugin(writer);
    const testAuditService = new DeaAuditService(auditplugin, true, [], []);

    await testAuditService.writeCJISCompliantEntry({
      dateTime: new Date().toISOString(),
      requestPath: '/',
      sourceComponent: AuditEventSource.API_GATEWAY,
      eventType: AuditEventType.CREATE_CASE,
      actorIdentity: { idType: IdentityType.COGNITO_ID, idPoolUserId: 'identifier', sourceIp: '123' },
      result: AuditEventResult.SUCCESS,
      downloadReason: 'me cop, need see evidence;\\',
      eventID: '11111111-1111-1111-1111-111111111111',
    });
    verify(clientMock.send(anyOfClass(CreateLogStreamCommand)));
    verify(clientMock.send(anyOfClass(PutLogEventsCommand)));
  });

  it('throws an error if logs were rejected', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    when(clientMock.send(anyOfClass(PutLogEventsCommand))).thenResolve({
      $metadata: { httpStatusCode: 200 },
      rejectedLogEventsInfo: {
        tooNewLogEventStartIndex: 1,
      },
    });
    const clientMockInstance = instance(clientMock);
    const writer = new DeaAuditWriter(clientMockInstance);
    const auditplugin = new BaseAuditPlugin(writer);
    const testAuditService = new DeaAuditService(auditplugin, true, [], []);

    await expect(
      testAuditService.writeCJISCompliantEntry({
        dateTime: new Date().toISOString(),
        requestPath: '/',
        sourceComponent: AuditEventSource.API_GATEWAY,
        eventType: AuditEventType.CREATE_CASE,
        actorIdentity: { idType: IdentityType.COGNITO_ID, idPoolUserId: 'identifier', sourceIp: '123' },
        result: AuditEventResult.SUCCESS,
        downloadReason: 'me cop, need see evidence;\\',
        eventID: '11111111-1111-1111-1111-111111111111',
      })
    ).rejects.toThrow(Error);
    verify(clientMock.send(anyOfClass(CreateLogStreamCommand)));
    verify(clientMock.send(anyOfClass(PutLogEventsCommand)));
  });

  it('throws an error if putlogs indicates an error', async () => {
    const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
    when(clientMock.send(anyOfClass(PutLogEventsCommand))).thenResolve({
      $metadata: { httpStatusCode: 400 },
    });
    const clientMockInstance = instance(clientMock);
    const writer = new DeaAuditWriter(clientMockInstance);
    const auditplugin = new BaseAuditPlugin(writer);
    const testAuditService = new DeaAuditService(auditplugin, true, [], []);

    await expect(
      testAuditService.writeCJISCompliantEntry({
        dateTime: new Date().toISOString(),
        requestPath: '/',
        sourceComponent: AuditEventSource.API_GATEWAY,
        eventType: AuditEventType.CREATE_CASE,
        actorIdentity: { idType: IdentityType.COGNITO_ID, idPoolUserId: 'identifier', sourceIp: '123' },
        result: AuditEventResult.SUCCESS,
        downloadReason: 'me cop, need see evidence;\\',
        eventID: '11111111-1111-1111-1111-111111111111',
      })
    ).rejects.toThrow(Error);
    verify(clientMock.send(anyOfClass(CreateLogStreamCommand)));
    verify(clientMock.send(anyOfClass(PutLogEventsCommand)));
  });

  it('exists', () => {
    expect(auditService).toBeDefined();
    expect('write' in auditService).toBeTruthy();
    expect('writeCJISCompliantEntry' in auditService).toBeTruthy();
  });
});
