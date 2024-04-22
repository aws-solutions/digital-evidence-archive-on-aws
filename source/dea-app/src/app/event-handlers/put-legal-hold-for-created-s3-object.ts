/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  ObjectLockLegalHoldStatus,
  PutObjectLegalHoldCommand,
  PutObjectLegalHoldCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Callback, Context, SQSMessageAttributes, SQSRecordAttributes } from 'aws-lambda';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';

const fipsSupported = getRequiredEnv('FIPS_SUPPORTED', 'false') === 'true';

export interface SQSS3ObjectCreatedDetail {
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventTime: Date;
  eventName: string;
  userIdentity: {
    principalId: string;
  };
  requestParameters: {
    sourceIPAddress: string;
  };
  responseElements: {
    'x-amz-request-id': string;
    'x-amz-id-2': string;
  };
  s3: {
    s3SchemaVersion: string;
    configurationId: string;
    bucket: {
      name: string;
      ownerIdentity: {
        principalId: string;
      };
      arn: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      versionId: string;
      sequencer: string;
    };
  };
}

export interface SQSS3ObjectCreatedDetailRecords {
  Records?: SQSS3ObjectCreatedDetail[];
}

export interface SQSS3ObjectCreatedRecord {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: SQSRecordAttributes;
  messageAttributes: SQSMessageAttributes;
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface SQSS3ObjectCreatedEvent {
  Records: SQSS3ObjectCreatedRecord[];
}

export type SQSS3ObjectCreatedSignature = (
  event: SQSS3ObjectCreatedEvent,
  _context: Context,
  _callback: Callback,
  s3Client: S3Client
) => Promise<string>;

export const putLegalHoldForCreatedS3Object: SQSS3ObjectCreatedSignature = async (
  event: SQSS3ObjectCreatedEvent,
  _context: Context,
  _callback: Callback,
  s3Client = new S3Client({
    useFipsEndpoint: fipsSupported,
    customUserAgent: getCustomUserAgent(),
  })
) => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  const legalHoldPromises: Promise<PutObjectLegalHoldCommandOutput>[] = [];
  event.Records.forEach((record) => {
    const recordBody: SQSS3ObjectCreatedDetailRecords = JSON.parse(record.body);
    recordBody.Records?.forEach((s3ObjectCreatedEvent) => {
      logger.info('locking created s3 object', {
        bucket: s3ObjectCreatedEvent.s3.bucket,
        object: s3ObjectCreatedEvent.s3.object,
      });

      legalHoldPromises.push(
        s3Client.send(
          new PutObjectLegalHoldCommand({
            Bucket: s3ObjectCreatedEvent.s3.bucket.name,
            Key: s3ObjectCreatedEvent.s3.object.key,
            LegalHold: { Status: ObjectLockLegalHoldStatus.ON },
            VersionId: s3ObjectCreatedEvent.s3.object.versionId,
          })
        )
      );
    });
  });
  await Promise.all(legalHoldPromises);

  return `Successfully processed ${event.Records.length} messages.`;
};
