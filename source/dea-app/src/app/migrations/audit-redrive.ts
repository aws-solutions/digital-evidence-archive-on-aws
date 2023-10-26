/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'crypto';
import { AthenaClient } from '@aws-sdk/client-athena';
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  DescribeLogStreamsCommandInput,
  GetLogEventsCommand,
  GetLogEventsCommandInput,
  LogStream,
  OrderBy,
} from '@aws-sdk/client-cloudwatch-logs';
import { Firehose, _Record } from '@aws-sdk/client-firehose';
import { LogEvent, putRecordsToFirehoseStream } from '../transform/audit-logs-to-s3-transformation-handler';
import AuditRedriveCandidateBuffer from './audit-redrive-candidate-buffer';

const throwUnset = (varName: string) => {
  throw new Error(`Required ENV ${varName} is not set.`);
};

const redriveEnv = {
  glueDBName: process.env.GLUE_DB ?? throwUnset('GLUE_DB'),
  glueTableName: process.env.GLUE_TABLE ?? throwUnset('GLUE_TABLE'),
  athenaWorkgroupName: process.env.ATHENA_WORKGROUP_NAME ?? throwUnset('ATHENA_WORKGROUP_NAME'),
  logGroups: [
    process.env.AUDIT_LOG_GROUP ?? throwUnset('AUDIT_LOG_GROUP'),
    process.env.TRAIL_LOG_GROUP ?? throwUnset('TRAIL_LOG_GROUP'),
  ],
  firehoseName: process.env.FIREHOSE_STREAM_NAME ?? throwUnset('FIREHOSE_STREAM_NAME'),
};

const cloudwatchLogsClient = new CloudWatchLogsClient();
const athenaClient = new AthenaClient();

const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function auditRedrive(
  startTimeMilliseconds: number,
  endTimeMilliseconds: number,
  dryRun = true
) {
  const dryRunPrefix = (dryRun && '[DRY_RUN] ') || '';
  console.log(
    `${dryRunPrefix}Executing Redrive for all events between ${new Date(
      startTimeMilliseconds
    ).toISOString()} and ${new Date(endTimeMilliseconds).toISOString()}`
  );
  const logRecordsForIngest: _Record[] = [];

  for (const logGroup of redriveEnv.logGroups) {
    await redriveLogGroup(logGroup, startTimeMilliseconds, endTimeMilliseconds, logRecordsForIngest);
  }

  // process the records in batches of 500
  if (logRecordsForIngest.length > 0) {
    let recordsReingestedSoFar = 0;
    const client = new Firehose();
    const maxBatchSize = 500;
    for (let i = 0; i < logRecordsForIngest.length; i += maxBatchSize) {
      const recordBatch = logRecordsForIngest.slice(i, i + maxBatchSize);
      if (!dryRun) {
        await putRecordsToFirehoseStream(redriveEnv.firehoseName, recordBatch, client, 0, 20);
      }
      recordsReingestedSoFar += recordBatch.length;
      console.debug(`Reingested ${recordsReingestedSoFar}/${logRecordsForIngest.length} Records`);
    }
  }
}

async function redriveLogGroup(
  logGroupName: string,
  startTimeMilliseconds: number,
  endTimeMilliseconds: number,
  logRecordsForIngest: _Record[]
) {
  const describeLogStreamsInput: DescribeLogStreamsCommandInput = {
    logGroupName,
    orderBy: OrderBy.LastEventTime,
    descending: false,
  };
  const initialDescribeLogStreamsCommand = new DescribeLogStreamsCommand(describeLogStreamsInput);
  let describeLogStreamsResponse = await cloudwatchLogsClient.send(initialDescribeLogStreamsCommand);
  while (describeLogStreamsResponse.logStreams) {
    for (const logStream of describeLogStreamsResponse.logStreams) {
      await redriveStream(
        logGroupName,
        logStream,
        startTimeMilliseconds,
        endTimeMilliseconds,
        logRecordsForIngest
      );
    }

    describeLogStreamsResponse.logStreams = undefined;
    if (describeLogStreamsResponse.nextToken) {
      describeLogStreamsInput.nextToken = describeLogStreamsResponse.nextToken;
      const describeLogStreamsCommand = new DescribeLogStreamsCommand(describeLogStreamsInput);
      describeLogStreamsResponse = await cloudwatchLogsClient.send(describeLogStreamsCommand);
    }
  }
}

async function redriveStream(
  logGroupName: string,
  logStream: LogStream,
  startTimeMilliseconds: number,
  endTimeMilliseconds: number,
  logRecordsForIngest: _Record[]
) {
  const candidateRedriveBuffer = new AuditRedriveCandidateBuffer(
    logRecordsForIngest,
    athenaClient,
    redriveEnv.glueDBName,
    redriveEnv.glueTableName,
    redriveEnv.athenaWorkgroupName,
    logGroupName,
    logStream.logStreamName ?? 'audit-log',
    logGroupName.includes('deaTrailLogs')
  );
  const getLogEventsInput: GetLogEventsCommandInput = {
    logGroupName,
    logStreamName: logStream.logStreamName,
    startFromHead: true,
    startTime: startTimeMilliseconds,
    endTime: endTimeMilliseconds,
  };

  const getLogEventsCommand = new GetLogEventsCommand(getLogEventsInput);
  // This operation has a limit of five transactions per second, after which transactions are throttled.
  let lastCallTime = Date.now();
  let getLogEventsResponse = await cloudwatchLogsClient.send(getLogEventsCommand);
  console.log(
    `get log events: ${logStream.logStreamName} | ${getLogEventsResponse.events?.length ?? 0} events`
  );
  // This operation can return empty results while there are more log events available through the token.
  while (getLogEventsResponse.events || getLogEventsResponse.nextForwardToken) {
    for (const event of getLogEventsResponse.events ?? []) {
      if (event.message) {
        const logEvent: LogEvent = {
          message: event.message,
          id: randomUUID(),
        };
        await candidateRedriveBuffer.push(logEvent);
      }
    }

    getLogEventsInput.nextToken = getLogEventsResponse.nextForwardToken;

    getLogEventsResponse.events = undefined;
    getLogEventsResponse.nextForwardToken = undefined;

    if (getLogEventsInput.nextToken) {
      const getAdditionalEventsCommand = new GetLogEventsCommand(getLogEventsInput);
      await delay(Math.max(0, 200 - (Date.now() - lastCallTime)));
      lastCallTime = Date.now();
      getLogEventsResponse = await cloudwatchLogsClient.send(getAdditionalEventsCommand);
      // This token is not null. If you have reached the end of the stream, it returns the same token you passed in.
      if (getLogEventsResponse.nextForwardToken === getLogEventsInput.nextToken) {
        getLogEventsResponse.nextForwardToken = undefined;
      }
    }

    console.log(
      `get log events: ${logStream.logStreamName} | ${getLogEventsResponse.events?.length ?? 0} events`
    );
  }

  await candidateRedriveBuffer.finish();
}
