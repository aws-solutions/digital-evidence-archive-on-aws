/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { Duration } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, EventType, NotificationKeyFilter } from 'aws-cdk-lib/aws-s3';
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';

export type LegalHoldBucketConfig = {
  bucket: Bucket;
  prefix: string;
};

export function addLegalHoldInfrastructure(
  scope: Construct,
  bucketConfigs: LegalHoldBucketConfig[],
  opsDashboard?: DeaOperationalDashboard
) {
  const objectLockHandler = new NodejsFunction(scope, 's3-object-locker', {
    memorySize: 512,
    tracing: Tracing.ACTIVE,
    timeout: Duration.seconds(60),
    runtime: Runtime.NODEJS_18_X,
    handler: 'handler',
    entry: path.join(__dirname, '../../src/handlers/put-legal-hold-for-created-s3-object-handler.ts'),
    depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
    },
    bundling: {
      externalModules: ['aws-sdk'],
      minify: true,
      sourceMap: true,
    },
  });

  opsDashboard?.addAuditLambdaErrorAlarm(objectLockHandler, 'ObjectLockLambda');

  const objectLockQueueKey = new Key(scope, 'objectLockQueueKey', {
    enableKeyRotation: true,
    removalPolicy: deaConfig.retainPolicy(),
    pendingWindow: Duration.days(7),
  });
  objectLockQueueKey.grantDecrypt(objectLockHandler);
  if (objectLockHandler.role) {
    objectLockQueueKey.addToResourcePolicy(
      new PolicyStatement({
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        principals: [objectLockHandler.role],
        resources: ['*'],
      })
    );
  }

  const objectLockDLQ = new Queue(scope, 's3-object-lock-dlq', {
    enforceSSL: true,
    encryptionMasterKey: objectLockQueueKey,
  });

  const objectLockQueue = new Queue(scope, 's3-object-lock-queue', {
    enforceSSL: true,
    visibilityTimeout: objectLockHandler.timeout,
    deadLetterQueue: {
      queue: objectLockDLQ,
      maxReceiveCount: 5,
    },
    encryptionMasterKey: objectLockQueueKey,
  });

  opsDashboard?.addDeadLetterQueueOperationalComponents('LegalHoldDLQ', objectLockDLQ);

  createCfnOutput(scope, 'objectLockQueueUrl', {
    value: objectLockQueue.queueUrl,
  });

  const eventSource = new SqsEventSource(objectLockQueue, {
    batchSize: 20,
    maxBatchingWindow: Duration.seconds(30),
  });

  objectLockHandler.addEventSource(eventSource);

  const sqsDestination = new SqsDestination(objectLockQueue);

  bucketConfigs.forEach((bucketConfig) => {
    objectLockHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObjectLegalHold', 's3:GetBucketObjectLockConfiguration', 's3:GetObjectLegalHold'],
        resources: [
          `${bucketConfig.bucket.bucketArn}`,
          `${bucketConfig.bucket.bucketArn}/${bucketConfig.prefix}*`,
        ],
      })
    );

    const notificationKeyFilters: NotificationKeyFilter[] = [];
    if (bucketConfig.prefix !== '') {
      notificationKeyFilters.push({ prefix: bucketConfig.prefix });
    }
    bucketConfig.bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      sqsDestination,
      ...notificationKeyFilters
    );
  });
  if (!objectLockHandler.role) {
    throw new Error('Lambda role undefined');
  }

  return objectLockHandler.role;
}
