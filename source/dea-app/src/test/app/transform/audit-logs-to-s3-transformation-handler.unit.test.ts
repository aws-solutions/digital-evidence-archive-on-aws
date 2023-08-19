/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Firehose, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import { FirehoseTransformationEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { transformAuditEventForS3 } from '../../../app/transform/audit-logs-to-s3-transformation-handler';
import { dummyContext } from '../../integration-objects';
import {
  FOUR_MB_PAYLOAD,
  MALFORMED_PAYLOAD,
  SINGLE_RECORD_MULTIPLE_MESSAGES_OVER_PAYLOAD_LIMIT,
  SINGLE_RECORD_SINGLE_MESSAGE_OVER_PAYLOAD_LIMIT,
  UNKNOWN_EVENT_PAYLOAD,
  UNPARSEABLE_PAYLOAD,
  VALID_CONTROL_MESSAGE,
  VALID_PAYLOAD,
} from './auditPayloads';

// Below for the data field in the test object you'll see a base64 string.
// to create these:
// create a file with your json contents
// gzip the file : `gzip somefile`
// encode the zipped file: `openssl base64 -in somefile.gz`

describe('audit logs event transformation', () => {
  it('skips control messages', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: VALID_CONTROL_MESSAGE,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Dropped');
    expect(result.records[0].data).toEqual('');
  });

  it('transforms log events', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: VALID_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const expectedData = Buffer.from('{"value":"something"}\n{"value":"something2"}\n', 'utf-8').toString(
      'base64'
    );

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Ok');
    expect(result.records[0].data).toEqual(expectedData);
  });

  it('splits up response payloads that are over 6mb', async () => {
    const firehoseMock = mockClient(Firehose);
    firehoseMock.resolves({});
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: SINGLE_RECORD_MULTIPLE_MESSAGES_OVER_PAYLOAD_LIMIT,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Dropped');
    expect(result.records[0].data).toEqual('');
    expect(firehoseMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 1);
  }, 30000);

  it('notifies of failure when a single record exceeds payload size limit', async () => {
    const firehoseMock = mockClient(Firehose);
    firehoseMock.resolves({});
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: SINGLE_RECORD_SINGLE_MESSAGE_OVER_PAYLOAD_LIMIT,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('ProcessingFailed');
    expect(result.records[0].data).toEqual('');
    expect(firehoseMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 0);
  }, 30000);

  it('splits records when they combine to exceed payload limit', async () => {
    const firehoseMock = mockClient(Firehose);
    firehoseMock.resolves({});
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: FOUR_MB_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
        {
          recordId: 'recordId2',
          data: FOUR_MB_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(2);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Ok');
    expect(result.records[1].recordId).toEqual('recordId2');
    expect(result.records[1].result).toEqual('Dropped');
    expect(result.records[1].data).toEqual('');
    expect(firehoseMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 1);
  }, 30000);

  it('notifies of failure on unknown event', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: UNKNOWN_EVENT_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('ProcessingFailed');
    expect(result.records[0].data).toEqual('');
  });

  it('notifies of non-json', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: MALFORMED_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Ok');
    expect(result.records[0].data).toEqual('e30K');
  });

  it('fails to process bad json', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: UNPARSEABLE_PAYLOAD,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('ProcessingFailed');
    expect(result.records[0].data).toEqual('');
  });

  it('notifies of firehose error responses', async () => {
    const firehoseMock = mockClient(Firehose);
    firehoseMock.resolves({
      RequestResponses: [
        {
          ErrorCode: 'ProvisionedThroughputExceededException',
        },
      ],
    });

    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: SINGLE_RECORD_MULTIPLE_MESSAGES_OVER_PAYLOAD_LIMIT,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    await expect(transformAuditEventForS3(transformationEvent, dummyContext)).rejects.toThrow(
      'Could not put records after 20 attempts. Individual error codes: ProvisionedThroughputExceededException'
    );
  });

  it('notifies of firehose exception', async () => {
    const firehoseMock = mockClient(Firehose);
    firehoseMock.rejects(new Error('some other error'));

    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: SINGLE_RECORD_MULTIPLE_MESSAGES_OVER_PAYLOAD_LIMIT,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    await expect(transformAuditEventForS3(transformationEvent, dummyContext)).rejects.toThrow(
      'Could not put records after 20 attempts. Error: some other error'
    );
  });
});
