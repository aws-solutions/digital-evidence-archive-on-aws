/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Readable } from 'stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Callback, Context, SQSEvent } from 'aws-lambda';
import cryptoJS from 'crypto-js';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { getObjectChecksumJob, upsertObjectChecksumJob } from '../../persistence/object-checksum-job';
import { ModelRepositoryProvider, defaultProvider } from '../../persistence/schema/entities';
import { updateCaseFileChecksum } from '../services/case-file-service';

const fipsSupported = getRequiredEnv('AWS_USE_FIPS_ENDPOINT', 'false') === 'true';

export interface MultipartChecksumBody {
  caseUlid: string;
  caseFileUlid: string;
  s3Key: string;
  s3Bucket: string;
  currentPart: number;
  totalParts: number;
}

export type SQSS3ObjectCreatedSignature = (
  event: SQSEvent,
  _context: Context,
  _callback: Callback,
  s3Client: S3Client,
  repositoryProvider: ModelRepositoryProvider
) => Promise<string>;

export const calculateIncrementalChecksum: SQSS3ObjectCreatedSignature = async (
  event: SQSEvent,
  _context: Context,
  _callback: Callback,
  s3Client = new S3Client({
    useFipsEndpoint: fipsSupported,
    customUserAgent: getCustomUserAgent(),
  }),
  repositoryProvider = defaultProvider
) => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug(`processing ${event.Records.length} records`);
  for (const record of event.Records) {
    const checksumJobMessage: MultipartChecksumBody = JSON.parse(record.body);
    logger.debug(JSON.stringify(checksumJobMessage));
    const finalPart = checksumJobMessage.currentPart === checksumJobMessage.totalParts;

    const objectChecksumJob = (await getObjectChecksumJob(
      checksumJobMessage.caseUlid,
      checksumJobMessage.caseFileUlid,
      repositoryProvider
    )) ?? {
      parentUlid: checksumJobMessage.caseUlid,
      fileUlid: checksumJobMessage.caseFileUlid,
      serializedHasher: '',
    };
    // fetch the s3 object part
    logger.debug(
      `Fetching s3 object part ${checksumJobMessage.currentPart}/${checksumJobMessage.totalParts}`
    );
    const getObjectPartCommand = new GetObjectCommand({
      PartNumber: checksumJobMessage.currentPart,
      Key: checksumJobMessage.s3Key,
      Bucket: checksumJobMessage.s3Bucket,
    });
    const response = await s3Client.send(getObjectPartCommand);
    // calculate the checksum
    const hasher = parseHasher(objectChecksumJob.serializedHasher);

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

    // if this is the final part, update the file with the checksum
    if (finalPart) {
      logger.debug(`sha256Hash ${hashOrSerializedHasher}`);

      logger.debug('Updating s3 object with checksum');
      await updateCaseFileChecksum(
        checksumJobMessage.caseUlid,
        checksumJobMessage.caseFileUlid,
        hashOrSerializedHasher,
        repositoryProvider
      );
    } else {
      // else, update the object checksum job
      await upsertObjectChecksumJob(
        {
          parentUlid: checksumJobMessage.caseUlid,
          fileUlid: checksumJobMessage.caseFileUlid,
          serializedHasher: hashOrSerializedHasher,
        },
        repositoryProvider
      );
    }
  }

  return `Successfully processed ${event.Records.length} messages.`;
};

function parseHasher(serializedHasher: string) {
  const sha = cryptoJS.algo.SHA256.create();
  if (serializedHasher !== '') {
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
