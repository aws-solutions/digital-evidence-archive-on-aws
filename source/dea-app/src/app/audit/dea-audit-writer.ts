/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import AuditEntry from '@aws/workbench-core-audit/lib/auditEntry';
import Metadata from '@aws/workbench-core-audit/lib/metadata';
import Writer from '@aws/workbench-core-audit/lib/plugins/writer';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommandOutput,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { now } from 'lodash';
import { ulid } from 'ulid';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { CJISAuditEventBody } from '../services/audit-service';

// defaults are provided to handle local testing where these will not be set
// the lambda name is used to name the logstream
const lambdaName = getRequiredEnv('AWS_LAMBDA_FUNCTION_NAME', 'NO_LAMBDA_NAME_FOUND');
// the audit log group we will write to
const auditLogGroup = getRequiredEnv('AUDIT_LOG_GROUP_NAME', 'NO_AUDIT_LOG_GROUP');

export default class DeaAuditWriter implements Writer {
  private isLogStreamReady: Promise<CreateLogGroupCommandOutput> | undefined;
  private logStreamName: string;

  public constructor(private cloudwatchClient: CloudWatchLogsClient) {
    this.logStreamName = `${lambdaName}-${ulid()}`.replaceAll(':', '');
    if (auditLogGroup !== 'NO_AUDIT_LOG_GROUP') {
      const createLogStreamCommand = new CreateLogStreamCommand({
        logGroupName: auditLogGroup,
        logStreamName: this.logStreamName,
      });
      this.isLogStreamReady = this.cloudwatchClient.send(createLogStreamCommand);
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
    auditEntry.targetUserId = entry.targetUserId;
    auditEntry.caseActions = entry.caseActions;
    auditEntry.eventID = entry.eventID;
  }

  public async write(metadata: Metadata, auditEntry: AuditEntry): Promise<void> {
    await this.isLogStreamReady;
    const putLogsCommand = new PutLogEventsCommand({
      logGroupName: auditLogGroup,
      logStreamName: this.logStreamName,
      logEvents: [{ timestamp: now(), message: JSON.stringify(auditEntry) }],
    });

    const putResponse = await this.cloudwatchClient.send(putLogsCommand);
    if (putResponse.rejectedLogEventsInfo || putResponse.$metadata.httpStatusCode !== 200) {
      logger.error('PutLogEvents Failure', { putResponse });
      throw new Error();
    }
  }
}
