/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import * as glue from '@aws-cdk/aws-glue-alpha';
import { Aws, Duration, Fn, StackProps, aws_kinesisfirehose } from 'aws-cdk-lib';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, LogGroup, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption, EventType, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { auditGlueTableColumns } from './audit-glue-table-columns';
import { FirehoseDestination } from './firehose-destination';

interface AuditCloudwatchToAthenaProps extends StackProps {
  readonly kmsKey: Key;
  readonly auditLogGroup: LogGroup;
  readonly trailLogGroup: LogGroup;
}

export class AuditCloudwatchToAthenaInfra extends Construct {
  public athenaTableName: string;
  public athenaDBName: string;
  public athenaWorkGroupName: string;

  public constructor(scope: Construct, stackName: string, props: AuditCloudwatchToAthenaProps) {
    super(scope, stackName);
    const fireHosetoS3Role = new Role(this, 'FireHosetoS3Role', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    });

    const auditBucket = new Bucket(this, 'auditBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      objectLockEnabled: true,
    });

    const auditPrefix = 'audit/';

    if (!deaConfig.isTestStack()) {
      this.addLegalHoldInfrastructure(auditBucket, auditPrefix);
    }

    const queryResultBucket = new Bucket(this, 'queryResultBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      versioned: true,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const athenaWorkgroup = new CfnWorkGroup(this, 'athenaWorkgroup', {
      name: `${Aws.STACK_NAME}-dea-athena-workgroup`,
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: queryResultBucket.s3UrlForObject(),
          expectedBucketOwner: Aws.ACCOUNT_ID,
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: props.kmsKey.keyArn,
          },
        },
        enforceWorkGroupConfiguration: true,
        customerContentEncryptionConfiguration: {
          kmsKey: props.kmsKey.keyArn,
        },
      },
      recursiveDeleteOption: true,
    });
    this.athenaWorkGroupName = athenaWorkgroup.name;

    // firehose to s3 permissions
    fireHosetoS3Role.addToPolicy(
      new PolicyStatement({
        actions: [
          's3:AbortMultipartUpload',
          's3:GetBucketLocation',
          's3:GetObject',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:PutObject',
        ],
        resources: [auditBucket.bucketArn, `${auditBucket.bucketArn}/*`],
      })
    );
    props.kmsKey.grantEncrypt(fireHosetoS3Role);

    const lambda = new NodejsFunction(this, 'audit-processing-lambda', {
      // Our kinesis hint is 3MB, assume a high decompression of 10x, 512mb will be plenty
      memorySize: 512,
      // transformation lambda has a maximum execution of 5 minutes
      timeout: Duration.minutes(5),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/handlers/audit-logs-transform-handler.ts'),
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

    lambda.grantInvoke(fireHosetoS3Role);

    const fhose = new aws_kinesisfirehose.CfnDeliveryStream(this, 'Delivery Stream', {
      deliveryStreamType: 'DirectPut',
      deliveryStreamEncryptionConfigurationInput: {
        keyType: 'CUSTOMER_MANAGED_CMK',
        keyArn: props.kmsKey.keyArn,
      },
      extendedS3DestinationConfiguration: {
        // The EncryptionConfiguration property type specifies the encryption settings that Amazon Kinesis Data Firehose
        // (Kinesis Data Firehose) uses when delivering data to Amazon Simple Storage Service (Amazon S3).
        encryptionConfiguration: {
          kmsEncryptionConfig: {
            awskmsKeyArn: props.kmsKey.keyArn,
          },
        },
        /*
        The Lambda synchronous invocation mode has a payload size limit of 6 MB for both the request and the response.
        Make sure that your buffering size for sending the request to the function is less than or equal to 6 MB.
        Also ensure that the response that your function returns doesn't exceed 6 MB
         */
        bufferingHints: {
          sizeInMBs: 3,
          intervalInSeconds: 60,
        },
        bucketArn: auditBucket.bucketArn,
        prefix: auditPrefix,
        errorOutputPrefix: 'deliveryErrors',
        roleArn: fireHosetoS3Role.roleArn,
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: `${Aws.STACK_NAME}_firehoseErrors`,
          logStreamName: `${Aws.STACK_NAME}_firehoseErrorStream`,
        },
        compressionFormat: 'GZIP',
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              parameters: [{ parameterName: 'LambdaArn', parameterValue: lambda.functionArn }],
              type: 'Lambda',
            },
          ],
        },
      },
    });

    const fhoseArn = Fn.getAtt(fhose.logicalId, 'Arn').toString();
    const destination = new FirehoseDestination(fhoseArn);

    // All application-generated events
    new SubscriptionFilter(this, 'logsSubFilter', {
      destination,
      filterPattern: FilterPattern.allEvents(),
      logGroup: props.auditLogGroup,
    });

    // Only CloudTrail events with identifying info
    new SubscriptionFilter(this, 'trailSubFilter', {
      destination,
      filterPattern: FilterPattern.any(
        FilterPattern.exists('$.userIdentity.userName'),
        FilterPattern.exists('$.userIdentity.sessionContext.sessionIssuer.userName')
      ),
      logGroup: props.trailLogGroup,
    });

    const glueDB = new glue.Database(this, 'auditDB');
    const glueTable = new glue.Table(this, 'auditTable', {
      bucket: auditBucket,
      database: glueDB,
      columns: auditGlueTableColumns,
      dataFormat: glue.DataFormat.JSON,
    });
    this.athenaDBName = glueDB.databaseName;
    this.athenaTableName = glueTable.tableName;
  }

  private addLegalHoldInfrastructure(auditBucket: Bucket, auditPrefix: string) {
    const objectLockHandler = new NodejsFunction(this, 'audit-object-locker', {
      memorySize: 512,
      timeout: Duration.seconds(60),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/handlers/put-legal-hold-for-created-s3-audit-object-handler.ts'),
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

    objectLockHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:PutObjectLegalHold', 's3:GetBucketObjectLockConfiguration', 's3:GetObjectLegalHold'],
        resources: [`${auditBucket.bucketArn}`, `${auditBucket.bucketArn}/${auditPrefix}*`],
      })
    );

    const objectLockDLQ = new Queue(this, 'audit-object-lock-dlq', {});

    const objectLockQueue = new Queue(this, 'audit-object-lock-queue', {
      visibilityTimeout: objectLockHandler.timeout,
      deadLetterQueue: {
        queue: objectLockDLQ,
        maxReceiveCount: 5,
      },
    });

    const eventSource = new SqsEventSource(objectLockQueue);

    objectLockHandler.addEventSource(eventSource);

    auditBucket.addEventNotification(EventType.OBJECT_CREATED, new SqsDestination(objectLockQueue), {
      prefix: auditPrefix,
    });
  }
}
