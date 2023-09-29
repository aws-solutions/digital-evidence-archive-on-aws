/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import zlib from 'zlib';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetQueryResultsCommandInput,
  QueryExecutionState,
  Row,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { _Record } from '@aws-sdk/client-firehose';
import { isDefined } from '../../persistence/persistence-helpers';
import { CWLRecord, LogEvent } from '../transform/audit-logs-to-s3-transformation-handler';

const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

type SessionContextIdentity = {
  sessionContext?: {
    sessionIssuer?: {
      userName?: string;
    };
  };
};

type UserIdentity = {
  userName?: string;
};

type LogEventWithId = {
  logEvent: LogEvent;
  eventID: string;
};

type AuditLogEvent = {
  // eventID may be null for pre v1.0.5 events, we'll hash the message body
  eventID?: string;
  userIdentity?: UserIdentity | SessionContextIdentity;
};

const terminalStates = [
  QueryExecutionState.CANCELLED.valueOf(),
  QueryExecutionState.FAILED.valueOf(),
  QueryExecutionState.SUCCEEDED.valueOf(),
  undefined,
];

export default class AuditRedriveCandidateBuffer {
  private candidateLogEvents: LogEventWithId[] = [];
  private filteredCount = 0;

  constructor(
    private logRecordsForRedrive: _Record[],
    private athenaClient: AthenaClient,
    private athenaDBName: string,
    private athenaTableName: string,
    private athenaWorkgroupName: string,
    private logGroupName: string,
    private logStreamName: string,
    private applyTrailFilter = false,
    private bufferLimit = 6000
  ) {}

  public async push(logEvent: LogEvent) {
    const theEvent: AuditLogEvent = JSON.parse(logEvent.message);
    if (this.applyTrailFilter && !this.hasIdentifyingInformation(theEvent)) {
      this.filteredCount++;
      return;
    }

    if (!theEvent.eventID) {
      const hash = crypto.createHash('sha256').update(logEvent.message).digest('base64');
      console.log(`${logEvent.message} | ${hash}`);
      theEvent.eventID = hash;
    }

    this.candidateLogEvents.push({
      logEvent,
      eventID: theEvent.eventID,
    });
    if (this.candidateLogEvents.length >= this.bufferLimit) {
      await this.flush();
    }
  }

  private async flush() {
    if (this.candidateLogEvents.length > 0) {
      const logEventsForIngest = (await this.filterOutPresentEvents()).map((logEvent) => logEvent.logEvent);

      if (logEventsForIngest.length > 0) {
        const cwlrecord = this.createCWLRecord(logEventsForIngest, this.logGroupName, this.logStreamName);
        const ingestionRecord = this.createIngestionRecord(cwlrecord);
        this.logRecordsForRedrive.push(ingestionRecord);
      }

      this.candidateLogEvents = [];
      this.filteredCount = 0;
    }
  }

  public async finish() {
    await this.flush();
  }

  private hasIdentifyingInformation(event: AuditLogEvent): boolean {
    return (
      event.userIdentity !== undefined &&
      (this.hasUserName(event.userIdentity) || this.hasSessionIssuerUserName(event.userIdentity))
    );
  }

  private hasUserName(identity: UserIdentity | SessionContextIdentity): boolean {
    return 'userName' in identity && identity.userName !== undefined;
  }

  private hasSessionIssuerUserName(identity: UserIdentity | SessionContextIdentity): boolean {
    return (
      'sessionContext' in identity &&
      identity.sessionContext !== undefined &&
      'sessionIssuer' in identity.sessionContext &&
      identity.sessionContext.sessionIssuer !== undefined &&
      'userName' in identity.sessionContext.sessionIssuer &&
      identity.sessionContext.sessionIssuer.userName !== undefined
    );
  }

  // Filter out any events which are already present in Athena
  private async filterOutPresentEvents(): Promise<LogEventWithId[]> {
    const candidateEventIds = this.candidateLogEvents.map((logEvent) => logEvent.eventID);
    const queryString = `SELECT eventID, count(1) FROM "${this.athenaDBName}"."${
      this.athenaTableName
    }" where eventID in ('${candidateEventIds.join("','")}') GROUP BY eventID;`;

    const startAthenaQueryCmd = new StartQueryExecutionCommand({
      QueryString: queryString,
      WorkGroup: this.athenaWorkgroupName,
    });

    const startResponse = await this.athenaClient.send(startAthenaQueryCmd);
    const queryId = startResponse.QueryExecutionId;
    if (!queryId) {
      throw new Error('Unknown error starting Athena Query.');
    }
    const getExecCmd = new GetQueryExecutionCommand({
      QueryExecutionId: queryId,
    });
    let getResultsResponse = await this.athenaClient.send(getExecCmd);
    while (!terminalStates.includes(getResultsResponse.QueryExecution?.Status?.State)) {
      await delay(1000);
      getResultsResponse = await this.athenaClient.send(getExecCmd);
    }
    if (getResultsResponse.QueryExecution?.Status?.State !== QueryExecutionState.SUCCEEDED) {
      throw new Error(
        `Athena query failed to execute. ${getResultsResponse.QueryExecution?.Status?.State}: ${getResultsResponse.QueryExecution?.Status?.StateChangeReason}`
      );
    }

    const getEventID = (row: Row) => {
      const data = row.Data;
      if (data) {
        return data[0].VarCharValue;
      }
      return undefined;
    };

    const getQueryResultsInput: GetQueryResultsCommandInput = {
      QueryExecutionId: queryId,
      MaxResults: 1000,
    };
    const getQueryResultsCmd = new GetQueryResultsCommand(getQueryResultsInput);
    let getQueryResultsResponse = await this.athenaClient.send(getQueryResultsCmd);
    const foundEventIds = getQueryResultsResponse.ResultSet?.Rows?.map(getEventID).filter(isDefined) ?? [];

    while (getQueryResultsResponse.NextToken) {
      getQueryResultsInput.NextToken = getQueryResultsResponse.NextToken;
      const getAdditionalQueryResultsCmd = new GetQueryResultsCommand(getQueryResultsInput);
      getQueryResultsResponse = await this.athenaClient.send(getAdditionalQueryResultsCmd);
      foundEventIds.push(
        ...(getQueryResultsResponse.ResultSet?.Rows?.map(getEventID).filter(isDefined) ?? [])
      );
    }

    // foundEventIds.length-1 for the header row
    console.log(
      [
        'Flush',
        `${this.candidateLogEvents.length} candidate events`,
        `${foundEventIds.length - 1} events already present in Athena`,
        `${this.filteredCount} events excluded by Cloudtrail filter`,
      ].join(' | ')
    );

    return this.candidateLogEvents.filter((logEvent) => {
      const alreadyPresent = foundEventIds.includes(logEvent.eventID);
      if (!alreadyPresent) {
        console.log(`redriving ${logEvent.eventID}`);
      }
      return !alreadyPresent;
    });
  }

  private createCWLRecord(logEvents: LogEvent[], logGroup: string, logStream: string): Buffer {
    const cwlrecord: CWLRecord = {
      messageType: 'DATA_MESSAGE',
      owner: '',
      logGroup,
      logStream,
      subscriptionFilters: [],
      logEvents,
    };
    return zlib.gzipSync(Buffer.from(JSON.stringify(cwlrecord), 'utf-8'));
  }

  private createIngestionRecord(data: Buffer): _Record {
    return { Data: data };
  }
}
