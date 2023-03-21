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
import { logger } from '../../logger';
import { CJISAuditEventBody } from '../services/audit-service';

const lambdaName = getRequiredEnv('AWS_LAMBDA_FUNCTION_NAME', 'NO_LAMBDA_NAME_FOUND');
const auditLogGroup = getRequiredEnv('AUDIT_LOG_GROUP_NAME', 'NO_AUDIT_LOG_GROUP');

export default class DeaAuditWriter implements Writer {
  private _isLogStreamReady: Promise<CreateLogGroupCommandOutput> | undefined;
  private _logStreamName: string;

  public constructor(private cloudwatchClient: CloudWatchLogsClient) {
    this._logStreamName = `${lambdaName}-${new Date().toISOString()}`.replaceAll(':', '');
    if (auditLogGroup !== 'NO_AUDIT_LOG_GROUP') {
      const createLogStreamCommand = new CreateLogStreamCommand({
        logGroupName: auditLogGroup,
        logStreamName: this._logStreamName,
      });
      this._isLogStreamReady = this.cloudwatchClient.send(createLogStreamCommand);
    }
  }

  public async prepare(metadata: Metadata, auditEntry: AuditEntry): Promise<void> {
    // making an assertion here as we'll always be passing CJISAuditEventBody for metadata
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const entry = metadata as CJISAuditEventBody;
    auditEntry.actorIdentity = entry.actorIdentity;
    auditEntry.dateTime = entry.dateTime;
    auditEntry.eventType = entry.eventType;
    auditEntry.requestPath = entry.requestPath;
    auditEntry.result = entry.result;
    auditEntry.sourceComponent = entry.sourceComponent;
    auditEntry.fileHash = entry.fileHash;
    auditEntry.caseId = entry.caseId;
    auditEntry.fileId = entry.fileId;
  }

  public async write(metadata: Metadata, auditEntry: AuditEntry): Promise<void> {
    await this._isLogStreamReady;
    const putLogsCommand = new PutLogEventsCommand({
      logGroupName: auditLogGroup,
      logStreamName: this._logStreamName,
      logEvents: [{ timestamp: now(), message: JSON.stringify(auditEntry) }],
    });

    const putResponse = await this.cloudwatchClient.send(putLogsCommand);
    if (putResponse.rejectedLogEventsInfo || putResponse.$metadata.httpStatusCode !== 200) {
      logger.error('PutLogEvents Failure', { putResponse });
      throw new Error();
    }
  }
}
