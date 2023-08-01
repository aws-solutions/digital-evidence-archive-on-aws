/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import zlib from 'zlib';
import {
  Context,
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
  FirehoseTransformationResult,
  FirehoseTransformationResultRecord,
} from 'aws-lambda';

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
function transformLogEvent(logEvent: { message: unknown }) {
  return `${logEvent.message}\n`;
}

function processRecords(records: FirehoseTransformationEventRecord[]): FirehoseTransformationResultRecord[] {
  return records.map((r) => {
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
      const logEvents: { message: unknown }[] = data.logEvents;
      const joinedData = logEvents.map((e) => transformLogEvent(e));
      const encodedData = Buffer.from(joinedData.join(''), 'utf-8').toString('base64');
      return {
        data: encodedData,
        result: 'Ok',
        recordId: recId,
      };
    } else {
      return {
        result: 'ProcessingFailed',
        recordId: recId,
        data: '',
      };
    }
  });
}

function loadJsonGzipBase64(base64Data: string) {
  return JSON.parse(zlib.gunzipSync(Buffer.from(base64Data, 'base64')).toString());
}

export const transformAuditEventForS3 = async function (
  event: FirehoseTransformationEvent,
  _context: Context
): Promise<FirehoseTransformationResult> {
  const records = processRecords(event.records);

  return { records: records };
};
