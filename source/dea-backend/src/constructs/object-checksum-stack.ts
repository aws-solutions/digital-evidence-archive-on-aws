/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { Duration, CfnResource, NestedStack } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { addLambdaSuppressions, addResourcePolicySuppressions } from './../helpers/nag-suppressions';
import { DeaOperationalDashboard } from './dea-ops-dashboard';

interface ObjectChecksumStackProps {
  deaTable: Table;
  kmsKey: Key;
  objectBucket: Bucket;
  opsDashboard?: DeaOperationalDashboard;
}

export class ObjectChecksumStack extends NestedStack {
  public checksumHandlerRole: IRole;
  public checksumQueue: Queue;
  public kmsKey: Key;

  constructor(scope: Construct, id: string, props: ObjectChecksumStackProps) {
    super(scope, id);

    const members = this.createHashQueue(this, props);
    this.checksumHandlerRole = members.handlerRole;
    this.checksumQueue = members.checksumQueue;
    this.kmsKey = members.kmsKey;
    this.cfnNagSuppress();
  }

  private createHashQueue(scope: Construct, props: ObjectChecksumStackProps) {
    // Performance note: We could increase the timeout and either a: process batches, or b: process multiple parts
    // Our largest parts can be around 525 MiB (5 TiB / 10,000)
    // We need enough time (and memory) to download 525 MiB, calculate a hash and write to either SQS or DynamoDB
    // Searching around shows about 70 MBps is safe
    // 7.5s to download
    // < 10s to compute hash
    // < 5s to write to SQS/DynamoDB write
    const runtimeWithPadding = Duration.seconds(30);
    const checksumHandler = new NodejsFunction(scope, 'incremental-checksum-handler', {
      memorySize: 1024,
      tracing: Tracing.ACTIVE,
      timeout: runtimeWithPadding,
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/handlers/calculate-incremental-checksum-handler.ts'),
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      environment: {
        TABLE_NAME: props.deaTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    const checkSumQueueKey = new Key(scope, 'checkSumQueueKey', {
      enableKeyRotation: true,
      removalPolicy: deaConfig.retainPolicy(),
      pendingWindow: Duration.days(7),
    });

    // we need to create a new key to prevent circular dependency
    checkSumQueueKey.grantDecrypt(checksumHandler);
    if (checksumHandler.role) {
      checkSumQueueKey.addToResourcePolicy(
        new PolicyStatement({
          actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
          principals: [checksumHandler.role],
          resources: ['*'],
        })
      );
    }

    // but we also need to grant permissions to the main kms key
    checksumHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [props.kmsKey.keyArn],
      })
    );

    const checksumDLQ = new Queue(scope, 'incremental-checksum-dlq', {
      enforceSSL: true,
      fifo: true,
      encryptionMasterKey: checkSumQueueKey,
    });

    const checksumQueue = new Queue(scope, 'incremental-checksum-queue', {
      enforceSSL: true,
      fifo: true,
      visibilityTimeout: checksumHandler.timeout,
      deadLetterQueue: {
        queue: checksumDLQ,
        maxReceiveCount: 5,
      },
      encryptionMasterKey: checkSumQueueKey,
    });

    const eventSource = new SqsEventSource(checksumQueue, {
      batchSize: 1,
    });

    checksumHandler.addEventSource(eventSource);

    this.setHandlerPermissions(
      checksumHandler,
      props.deaTable,
      checksumQueue,
      checkSumQueueKey,
      props.objectBucket
    );

    props.opsDashboard?.addDeadLetterQueueOperationalComponents('ChecksumDLQ', checksumDLQ);

    // return the handler role so we can add it to resource policies
    if (!checksumHandler.role) {
      throw new Error('Lambda role undefined');
    }

    return {
      checksumQueue,
      handlerRole: checksumHandler.role,
      kmsKey: checkSumQueueKey,
    };
  }

  private setHandlerPermissions(
    handler: NodejsFunction,
    deaTable: Table,
    queue: Queue,
    kmsKey: Key,
    bucket: Bucket
  ) {
    // we need key access for the encrypted bucket and table
    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [kmsKey.keyArn],
      })
    );

    // we will download from the datasets bucket
    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${bucket.bucketArn}/*`],
      })
    );

    // we will update the checksum value in DynamoDB
    // we will get, create, update and delete checksum jobs
    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [deaTable.tableArn],
      })
    );
  }

  private cfnNagSuppress() {
    // Nag Suppressions
    const policyToSuppress = this.node
      .findChild('incremental-checksum-handler')
      .node.findChild('ServiceRole')
      .node.findChild('DefaultPolicy').node.defaultChild;
    if (policyToSuppress instanceof CfnResource) {
      addResourcePolicySuppressions(policyToSuppress);
    }

    const resourceToSuppress = this.node.findChild('incremental-checksum-handler').node.findChild('Resource');
    if (resourceToSuppress instanceof CfnResource) {
      addLambdaSuppressions(resourceToSuppress);
    }
  }
}
