/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CloudWatchLogsClient,
  CreateLogGroupCommandOutput,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import AuditEntry from '@aws/workbench-core-audit/lib/auditEntry';
import Metadata from '@aws/workbench-core-audit/lib/metadata';
import Writer from '@aws/workbench-core-audit/lib/plugins/writer';
import { now } from 'lodash';
import { getRequiredEnv } from '../../lambda-http-helpers';

const auditLogGroup = getRequiredEnv('AUDIT_LOG_GROUP_NAME', 'AUDIT_LOG_GROUP_UNSPECIFIED');
const lambdaName = getRequiredEnv('AWS_LAMBDA_FUNCTION_NAME', 'NO_LAMBDA_NAME_FOUND');

export default class DeaAuditWriter implements Writer {
  private _isLogStreamReady: Promise<CreateLogGroupCommandOutput>;
  private _logStreamName: string;

  public constructor(private cloudwatchClient: CloudWatchLogsClient) {
    this._logStreamName = `${lambdaName}-${new Date().toISOString()}`.replaceAll(':', '');
    const createLogStreamCommand = new CreateLogStreamCommand({
      logGroupName: auditLogGroup,
      logStreamName: this._logStreamName,
    });
    this._isLogStreamReady = cloudwatchClient.send(createLogStreamCommand);
  }

  public async write(metadata: Metadata, auditEntry: AuditEntry): Promise<void> {
    // ensure logstream was created
    await this._isLogStreamReady;
    const putLogsCommand = new PutLogEventsCommand({
      logGroupName: auditLogGroup,
      logStreamName: this._logStreamName,
      logEvents: [{ timestamp: now(), message: JSON.stringify(auditEntry) }],
    });

    void this.cloudwatchClient.send(putLogsCommand);
  }
}
