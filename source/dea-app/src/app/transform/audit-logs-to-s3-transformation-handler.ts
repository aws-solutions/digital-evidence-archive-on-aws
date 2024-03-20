/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import zlib from 'zlib';
import { Firehose, _Record } from '@aws-sdk/client-firehose';
import {
  Context,
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
  FirehoseTransformationResult,
  FirehoseTransformationResultRecord,
} from 'aws-lambda';
import { getCustomUserAgent } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import ErrorPrefixes from '../error-prefixes';

/*
For processing data sent to Firehose by Cloudwatch Logs subscription filters.

Cloudwatch Logs sends to Firehose records that look like this:

{
  "messageType": "DATA_MESSAGE",
  "owner": "123456789012",
  "logGroup": "log_group_name",
  "logStream": "log_stream_name",
  "subscriptionFilters": [
    "subscription_filter_name"
  ],
  "logEvents": [
    {
      "id": "01234567890123456789012345678901234567890123456789012345",
      "timestamp": 1510109208016,
      "message": "log message 1"
    },
    {
      "id": "01234567890123456789012345678901234567890123456789012345",
      "timestamp": 1510109208017,
      "message": "log message 2"
    }
    ...
  ]
}

The data is additionally compressed with GZIP.

The code below will:

1) Gunzip the data
2) Parse the json
3) Set the result to ProcessingFailed for any record whose messageType is not DATA_MESSAGE, thus redirecting them to the
   processing error output. Such records do not contain any log events. You can modify the code to set the result to
   Dropped instead to get rid of these records completely.
4) For records whose messageType is DATA_MESSAGE, extract the individual log events from the logEvents field, and pass
   each one to the transformLogEvent method. transformLogEvent simply returns the event message,
  for Athena queries we don't want the surrounding info.
5) Concatenate the result from (4) together and set the result as the data of the record returned to Firehose.
7) The total data size (i.e. the sum over multiple records) after decompression, processing and base64-encoding
   must not exceed 6,000,000 bytes.
8) The retry count for intermittent failures during re-ingestion is set 20 attempts. If you wish to retry fewer number
   of times for intermittent failures you can lower this value.
*/

export type LogEvent = {
  id: string;
  message: string;
};

export type CWLRecord = {
  messageType: string;
  owner: string;
  logGroup: string;
  logStream: string;
  subscriptionFilters: string[];
  logEvents: LogEvent[];
};

export const transformAuditEventForS3 = async function (
  event: FirehoseTransformationEvent,
  _context: Context
): Promise<FirehoseTransformationResult> {
  // grab the info we need to put records back if we end up splitting them out
  const streamARN = event.deliveryStreamArn;
  const region = streamARN.split(':')[3];
  const streamName = streamARN.split('/')[1];

  const records = processRecords(event.records);

  let projectedSize = 0;
  const recordListsToReingest: _Record[][] = [];

  records.forEach((rec, idx) => {
    const originalRecord = event.records[idx];

    if (rec.result !== 'Ok' || !rec.data) {
      return;
    }

    // If a single record is too large after processing, split the original CWL data into two, each containing half
    // the log events, and re-ingest both of them (note that it is the original data that is re-ingested, not the
    // processed data).
    // If it's not possible to split because there is only one log event, then mark the record as
    // ProcessingFailed, which sends it to error output.
    if (rec.data.length > 6000000) {
      const cwlRecord = loadJsonGzipBase64(originalRecord.data);
      if (cwlRecord.logEvents.length > 1) {
        rec.result = 'Dropped';
        const splitRecords = splitCWLRecord(cwlRecord).map((data) =>
          createReingestionRecord(originalRecord, data)
        );
        recordListsToReingest.push(splitRecords);
      } else {
        rec.result = 'ProcessingFailed';
        logger.debug(
          `Record ${rec.recordId} contains only one log event but is still too large after processing ` +
            `(${rec.data.length} bytes), marking it as ${rec.result}`
        );
      }
      // this record will be returned as dropped, but we need to clear the data so we don't exceed the 6MB payload response
      rec.data = '';
    } else {
      projectedSize += rec.data.length + rec.recordId.length;
      // 6000000 instead of 6291456 to leave ample headroom for the stuff we didn't account for
      if (projectedSize > 6000000) {
        recordListsToReingest.push([createReingestionRecord(originalRecord)]);
        // this record will be returned as dropped, but we need to clear the data so we don't exceed the 6MB payload response
        rec.data = '';
        rec.result = 'Dropped';
      }
    }
  });

  // call putRecordBatch/putRecords for each group of up to 500 records to be re-ingested
  if (recordListsToReingest.length > 0) {
    let recordsReingestedSoFar = 0;
    const clientArgs = { region: region, customUserAgent: getCustomUserAgent() };
    const client = new Firehose(clientArgs);
    const maxBatchSize = 500;
    const flattenedList = recordListsToReingest.flat();
    for (let i = 0; i < flattenedList.length; i += maxBatchSize) {
      const recordBatch = flattenedList.slice(i, i + maxBatchSize);
      await putRecordsToFirehoseStream(streamName, recordBatch, client, 0, 20);
      recordsReingestedSoFar += recordBatch.length;
      logger.debug(`Reingested ${recordsReingestedSoFar}/${flattenedList.length}`);
    }
  }

  logger.debug(
    [
      `${event.records.length} input records`,
      `${records.filter((r) => r.result !== 'Dropped').length} returned as Ok or ProcessingFailed`,
      `${recordListsToReingest.filter((a) => a.length > 1).length} split and re-ingested`,
      `${recordListsToReingest.filter((a) => a.length === 1).length} re-ingested as-is`,
    ].join(', ')
  );

  return { records: records };
};

function createReingestionRecord(originalRecord: FirehoseTransformationEventRecord, data?: Buffer): _Record {
  if (data === undefined) {
    data = Buffer.from(originalRecord.data, 'base64');
  }
  const r = { Data: data };
  return r;
}

/**
 * logEvent has this format:
 *
 * {
 *   "id": "01234567890123456789012345678901234567890123456789012345",
 *   "timestamp": 1510109208016,
 *   "message": "log message 1"
 * }
 *
 * The default implementation below just extracts the message and appends a newline to it.
 */
function transformLogEvent(logEvent: LogEvent) {
  let validatedMessage: unknown;
  try {
    // Some event have been observed to have duplicate keys e.g. {Tagging: '', tagging: ''}
    // This will lead to a malformed json error preventing all queries in Athena
    // while ignore.malformed.json is turned on, we want to preserve whatever we can, so parse and re-stringify here
    validatedMessage = JSON.parse(logEvent.message);
    return `${JSON.stringify(validatedMessage)}\n`;
  } catch (e) {
    // only log the eventId for follow up
    logger.error(ErrorPrefixes.MALFORMED_JSON_PREFIX, { recordId: logEvent.id });
  }
  return `{}\n`;
}

function processRecords(records: FirehoseTransformationEventRecord[]): FirehoseTransformationResultRecord[] {
  return records.map((r) => {
    try {
      const data = loadJsonGzipBase64(r.data);
      const recId = r.recordId;
      // CONTROL_MESSAGE are sent by CWL to check if the subscription is reachable.
      // They do not contain actual data.
      if (data.messageType === 'CONTROL_MESSAGE') {
        return {
          result: 'Dropped',
          recordId: recId,
          data: '',
        };
      } else if (data.messageType === 'DATA_MESSAGE') {
        const logEvents: LogEvent[] = data.logEvents;
        const joinedData = logEvents.map((e) => transformLogEvent(e));
        const encodedData = Buffer.from(joinedData.join(''), 'utf-8').toString('base64');
        return {
          data: encodedData,
          result: 'Ok',
          recordId: recId,
        };
      } else {
        logger.debug('ProcessingFailed', { recordId: recId });
        return {
          result: 'ProcessingFailed',
          recordId: recId,
          data: '',
        };
      }
    } catch (e) {
      logger.error('ProcessingFailed', { recordId: r.recordId });
      return {
        result: 'ProcessingFailed',
        recordId: r.recordId,
        data: '',
      };
    }
  });
}

function loadJsonGzipBase64(base64Data: string): CWLRecord {
  return JSON.parse(zlib.gunzipSync(Buffer.from(base64Data, 'base64')).toString());
}

/**
 * Splits one CWL record into two, each containing half the log events.
 * Serializes and compreses the data before returning. That data can then be
 * re-ingested into the stream, and it'll appear as though they came from CWL
 * directly.
 */
function splitCWLRecord(cwlRecord: CWLRecord) {
  const logEvents = cwlRecord.logEvents;
  assert(logEvents.length > 1);
  const mid = logEvents.length / 2;
  const rec1 = Object.assign({}, cwlRecord);
  rec1.logEvents = logEvents.slice(0, mid);
  const rec2 = Object.assign({}, cwlRecord);
  rec2.logEvents = logEvents.slice(mid);
  return [rec1, rec2].map((r) => zlib.gzipSync(Buffer.from(JSON.stringify(r), 'utf-8')));
}

export async function putRecordsToFirehoseStream(
  streamName: string,
  records: _Record[],
  client: Firehose,
  attemptsMade: number,
  maxAttempts: number
) {
  let failed: _Record[] = [];
  let errMsg;
  try {
    const response = await client.putRecordBatch({
      DeliveryStreamName: streamName,
      Records: records,
    });

    const errCodes: string[] = [];
    response.RequestResponses?.forEach((r, i) => {
      if (r.ErrorCode) {
        errCodes.push(r.ErrorCode);
        failed.push(records[i]);
      }
    });

    errMsg = `Individual error codes: ${errCodes}`;
  } catch (error) {
    failed = records;
    errMsg = error;
  }

  if (failed.length > 0) {
    if (attemptsMade + 1 < maxAttempts) {
      logger.debug(`Some records failed while calling reingesting to Firehose, retrying. ${errMsg}`);
      await putRecordsToFirehoseStream(streamName, failed, client, attemptsMade + 1, maxAttempts);
    } else {
      logger.error(ErrorPrefixes.KINESIS_PUT_ERROR_PREFIX, { erroMsg: errMsg });
      throw new Error(`Could not put records after ${maxAttempts} attempts. ${errMsg}`);
    }
  }
}
