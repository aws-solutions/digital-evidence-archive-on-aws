/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ObjectLockLegalHoldStatus, PutObjectLegalHoldCommand, S3Client } from '@aws-sdk/client-s3';
import { anything, instance, mock, strictEqual, verify } from 'ts-mockito';
import { putLegalHoldForCreatedS3Object } from '../../../app/event-handlers/put-legal-hold-for-created-s3-object';
import {
  SQSS3ObjectCreatedDetailRecords,
  SQSS3ObjectCreatedRecord,
} from '../../../app/event-handlers/put-legal-hold-for-created-s3-object';
import { dummyContext } from '../../integration-objects';

describe('put legal hold for created s3 object', () => {
  it('calls PutObjectLegalHold API', async () => {
    const s3MockClient = mock(S3Client);
    const s3ObjectCreated = {
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-east-1',
      eventTime: new Date(),
      eventName: 'ObjectCreated:Put',
      userIdentity: {
        principalId: 'EXAMPLE',
      },
      requestParameters: {
        sourceIPAddress: '000000000',
      },
      responseElements: {
        'x-amz-request-id': 'EXAMPLE123456789',
        'x-amz-id-2': 'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'testConfigRule',
        bucket: {
          name: 'test-bucket',
          ownerIdentity: {
            principalId: 'EXAMPLE',
          },
          arn: 'arn:aws:s3:::test-bucket',
        },
        object: {
          key: 'test-key',
          size: 1024,
          eTag: '0123456789abcdef0123456789abcdef',
          versionId: '0987654321',
          sequencer: '0A1B2C3D4E5F678901',
        },
      },
    };
    const objectCreatedDetail: SQSS3ObjectCreatedDetailRecords = {
      Records: [s3ObjectCreated],
    };

    const objectCreatedRecord: SQSS3ObjectCreatedRecord = {
      messageId: 'message-id',
      receiptHandle: 'receipt-handle',
      body: JSON.stringify(objectCreatedDetail),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1523232000000',
        SenderId: '123456789012',
        ApproximateFirstReceiveTimestamp: '1523232000001',
        SequenceNumber: '1',
        MessageGroupId: 'message-group-id',
        MessageDeduplicationId: 'message-deduplication-id',
      },
      messageAttributes: {},
      md5OfBody: '098f6bcd4621d373cade4e832627b4f6',
      eventSource: 'aws:sqs',
      eventSourceARN: '0000000000000000000000000000000000:MyQueue',
      awsRegion: 'us-east-1',
    };

    const testRecord: SQSS3ObjectCreatedRecord = {
      messageId: 'message-id2',
      receiptHandle: 'receipt-handle2',
      body: JSON.stringify({}),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1523232000000',
        SenderId: '123456789012',
        ApproximateFirstReceiveTimestamp: '1523232000001',
        SequenceNumber: '1',
        MessageGroupId: 'message-group-id',
        MessageDeduplicationId: 'message-deduplication-id',
      },
      messageAttributes: {},
      md5OfBody: '098f6bcd4621d373cade4e832627b4f6',
      eventSource: 'aws:sqs',
      eventSourceARN: '0000000000000000000000000000000000:MyQueue',
      awsRegion: 'us-east-1',
    };

    await putLegalHoldForCreatedS3Object(
      {
        Records: [objectCreatedRecord, testRecord],
      },
      dummyContext,
      () => {
        /* do nothing */
      },
      instance(s3MockClient)
    );

    verify(s3MockClient.send(anything())).once();
    verify(
      s3MockClient.send(
        strictEqual(
          new PutObjectLegalHoldCommand({
            Bucket: s3ObjectCreated.s3.bucket.name,
            Key: s3ObjectCreated.s3.object.key,
            LegalHold: { Status: ObjectLockLegalHoldStatus.ON },
            VersionId: s3ObjectCreated.s3.object.versionId,
          })
        )
      )
    );
  });
});
