/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import BaseAuditPlugin from '@aws/workbench-core-audit/lib/plugins/baseAuditPlugin';
import { instance, mock } from 'ts-mockito';
import DeaAuditWriter from '../../app/audit/dea-audit-writer';
import { DeaAuditService } from '../../app/services/audit-service';

export type TestAuditService = {
  service: DeaAuditService;
  client: CloudWatchLogsClient;
};

export const getTestAuditService = (): TestAuditService => {
  const clientMock: CloudWatchLogsClient = mock(CloudWatchLogsClient);
  const clientMockInstance = instance(clientMock);
  const writer = new DeaAuditWriter(clientMockInstance);
  const auditplugin = new BaseAuditPlugin(writer);
  return {
    service: new DeaAuditService(auditplugin, true, [], []),
    client: clientMock,
  };
};
