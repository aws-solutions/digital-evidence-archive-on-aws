/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Readable } from 'stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Callback, Context, SQSEvent } from 'aws-lambda';
import cryptoJS from 'crypto-js';
import { logger } from '../../logger';
import { ModelRepositoryProvider, defaultProvider } from '../../persistence/schema/entities';
import { updateCaseFileChecksum } from '../services/case-file-service';

export interface MultipartChecksumBody {
  caseUlid: string;
  caseFileUlid: string;
  s3Key: string;
  s3Bucket: string;
  serializedHasher: string | undefined;
  currentPart: number;
  totalParts: number;
  queueUrl: string;
}

export type SQSS3ObjectCreatedSignature = (
  event: SQSEvent,
  _context: Context,
  _callback: Callback,
  s3Client: S3Client,
  sqsClient: SQSClient,
  repositoryProvider: ModelRepositoryProvider
) => Promise<string>;

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

export const calculateIncrementalChecksum: SQSS3ObjectCreatedSignature = async (
  event: SQSEvent,
  _context: Context,
  _callback: Callback,
  s3Client = new S3Client({}),
  sqsClient = new SQSClient({ region }),
  repositoryProvider = defaultProvider
) => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug(`processing ${event.Records.length} records`);
  for (const record of event.Records) {
    const checksumJob: MultipartChecksumBody = JSON.parse(record.body);
    logger.debug(JSON.stringify(checksumJob));
    const finalPart = checksumJob.currentPart === checksumJob.totalParts;
    // fetch the s3 object part
    logger.debug(`Fetching s3 object part ${checksumJob.currentPart}/${checksumJob.totalParts}`);
    const getObjectPartCommand = new GetObjectCommand({
      PartNumber: checksumJob.currentPart,
      Key: checksumJob.s3Key,
      Bucket: checksumJob.s3Bucket,
    });
    const response = await s3Client.send(getObjectPartCommand);
    // calculate the checksum
    const hasher = parseHasher(checksumJob.serializedHasher);

    const hashOrSerializedHasher: string = await new Promise((resolve, reject) => {
      if (response.Body instanceof Readable) {
        const stream = response.Body;
        stream.on('data', (d) => {
          hasher.update(cryptoJS.lib.WordArray.create(d));
        });
        stream.on('end', () => {
          if (finalPart) {
            resolve(hasher.finalize().toString(cryptoJS.enc.Base64));
          } else {
            resolve(JSON.stringify(hasher));
          }
        });
        stream.on('error', reject);
      } else {
        logger.error('response body not readable');
        reject();
      }
    });

    // if this is the final part, update the s3 object with the checksum
    if (finalPart) {
      logger.debug(`sha256Hash ${hashOrSerializedHasher}`);

      logger.debug('Updating s3 object with checksum');
      await updateCaseFileChecksum(
        checksumJob.caseUlid,
        checksumJob.caseFileUlid,
        hashOrSerializedHasher,
        repositoryProvider
      );
    } else {
      // else, update and repost the message body
      logger.debug(`queuing up next part ${checksumJob.currentPart + 1}/${checksumJob.totalParts}`);

      const newMessageBody: MultipartChecksumBody = {
        caseUlid: checksumJob.caseUlid,
        caseFileUlid: checksumJob.caseFileUlid,
        s3Key: checksumJob.s3Key,
        currentPart: checksumJob.currentPart + 1,
        totalParts: checksumJob.totalParts,
        serializedHasher: hashOrSerializedHasher,
        queueUrl: checksumJob.queueUrl,
        s3Bucket: checksumJob.s3Bucket,
      };
      const sendMessageCommand = new SendMessageCommand({
        QueueUrl: checksumJob.queueUrl,
        MessageBody: JSON.stringify(newMessageBody),
      });

      await sqsClient.send(sendMessageCommand);
    }
  }

  return `Successfully processed ${event.Records.length} messages.`;
};

function parseHasher(serializedHasher: string | undefined) {
  const sha = cryptoJS.algo.SHA256.create();
  if (serializedHasher) {
    restoreData(JSON.parse(serializedHasher), sha);
  }
  return sha;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function restoreData(source: any, target: any) {
  for (const prop in source) {
    const value = source[prop];
    if (typeof value == 'object') {
      if (typeof target[prop] != 'object') {
        target[prop] = {};
      }
      restoreData(source[prop], target[prop]);
    } else {
      target[prop] = source[prop];
    }
  }
}
