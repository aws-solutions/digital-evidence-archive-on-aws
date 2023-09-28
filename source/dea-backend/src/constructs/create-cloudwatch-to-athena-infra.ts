/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import ErrorPrefixes from '@aws/dea-app/lib/app/error-prefixes';
import * as glue from '@aws-cdk/aws-glue-alpha';
import { Aws, Duration, Fn, StackProps, aws_kinesisfirehose } from 'aws-cdk-lib';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { CfnTable } from 'aws-cdk-lib/aws-glue';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, LogGroup, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  EventType,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { auditGlueTableColumns } from './audit-glue-table-columns';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';
import { FirehoseDestination } from './firehose-destination';

interface AuditCloudwatchToAthenaProps extends StackProps {
  readonly kmsKey: Key;
  readonly auditLogGroup: LogGroup;
  readonly trailLogGroup: LogGroup;
  readonly opsDashboard?: DeaOperationalDashboard;
}

export class AuditCloudwatchToAthenaInfra extends Construct {
  public athenaTableName: string;
  public athenaDBName: string;
  public athenaWorkGroupName: string;
  public athenaOutputBucket: Bucket;
  public athenaAuditBucket: Bucket;

  public constructor(scope: Construct, stackName: string, props: AuditCloudwatchToAthenaProps) {
    super(scope, stackName);
    const fireHosetoS3Role = new Role(this, 'FireHosetoS3Role', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    });

    this.athenaAuditBucket = new Bucket(this, 'auditBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      objectLockEnabled: true,
    });

    createCfnOutput(this, 'auditBucketName', {
      value: this.athenaAuditBucket.bucketName,
    });

    const auditPrefix = 'audit/';

    this.addLegalHoldInfrastructure(this.athenaAuditBucket, auditPrefix, props.opsDashboard);

    const queryResultBucket = new Bucket(this, 'queryResultBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      versioned: true,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.HEAD],
          allowedHeaders: ['*'],
        },
      ],
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });
    this.athenaOutputBucket = queryResultBucket;

    createCfnOutput(this, 'queryResultBucketName', {
      value: queryResultBucket.bucketName,
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
        resources: [this.athenaAuditBucket.bucketArn, `${this.athenaAuditBucket.bucketArn}/*`],
      })
    );
    props.kmsKey.grantEncrypt(fireHosetoS3Role);

    const auditTransformLambda = new NodejsFunction(this, 'audit-processing-lambda', {
      // Our kinesis hint is 1MB, assume a high decompression of 10x, 512mb will be plenty
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

    props.opsDashboard?.addMetricFilterAlarmForLogGroup(
      auditTransformLambda.logGroup,
      FilterPattern.anyTerm(ErrorPrefixes.MALFORMED_JSON_PREFIX),
      'AuditTransformMalformed'
    );
    props.opsDashboard?.addMetricFilterAlarmForLogGroup(
      auditTransformLambda.logGroup,
      FilterPattern.anyTerm(ErrorPrefixes.KINESIS_PUT_ERROR_PREFIX),
      'AuditKinesisFailure'
    );
    props.opsDashboard?.addAuditLambdaErrorAlarm(auditTransformLambda, 'AuditTransformLambda');

    auditTransformLambda.grantInvoke(fireHosetoS3Role);

    const firehoseName = 'Delivery Stream';
    const fhose = new aws_kinesisfirehose.CfnDeliveryStream(this, firehoseName, {
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
          sizeInMBs: 1,
          intervalInSeconds: 60,
        },
        bucketArn: this.athenaAuditBucket.bucketArn,
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
              // Allowed values: BufferIntervalInSeconds | BufferSizeInMBs | Delimiter | JsonParsingEngine | LambdaArn | MetadataExtractionQuery | NumberOfRetries | RoleArn | SubRecordType
              parameters: [
                { parameterName: 'LambdaArn', parameterValue: auditTransformLambda.functionArn },
                { parameterName: 'BufferSizeInMBs', parameterValue: '1' },
                { parameterName: 'BufferIntervalInSeconds', parameterValue: '60' },
              ],
              type: 'Lambda',
            },
          ],
        },
      },
    });

    createCfnOutput(this, 'firehoseName', {
      value: fhose.ref,
    });

    // construct the arn here because using the arn directly leads to a circular dependency
    auditTransformLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['firehose:PutRecordBatch'],
        resources: [
          `arn:aws:firehose:${Aws.REGION}:${Aws.ACCOUNT_ID}:deliverystream/${
            Aws.STACK_NAME
          }-${stackName}${firehoseName.replaceAll(' ', '')}*`,
        ],
      })
    );

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
      bucket: this.athenaAuditBucket,
      database: glueDB,
      columns: auditGlueTableColumns,
      dataFormat: glue.DataFormat.JSON,
    });

    createCfnOutput(this, 'athenaDBName', {
      value: glueDB.databaseName,
    });
    createCfnOutput(this, 'athenaTableName', {
      value: glueTable.tableName,
    });
    createCfnOutput(this, 'athenaWorkgroupName', {
      value: this.athenaWorkGroupName,
    });

    //eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const tableNode = glueTable.node.defaultChild as CfnTable;
    tableNode.addPropertyOverride('TableInput.StorageDescriptor.SerdeInfo.Parameters', {
      // 'case.insensitive': 'false',
      // prevent malformed JSON from completely wrecking athena queries
      'ignore.malformed.json': 'true',
    });

    this.athenaDBName = glueDB.databaseName;
    this.athenaTableName = glueTable.tableName;
  }

  private addLegalHoldInfrastructure(
    auditBucket: Bucket,
    auditPrefix: string,
    opsDashboard?: DeaOperationalDashboard
  ) {
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

    opsDashboard?.addAuditLambdaErrorAlarm(objectLockHandler, 'AuditObjectLockLambda');

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

    opsDashboard?.addDeadLetterQueueOperationalComponents('AuditLegalHoldDLQ', objectLockDLQ);

    createCfnOutput(this, 'objectLockQueueUrl', {
      value: objectLockQueue.queueUrl,
    });

    const eventSource = new SqsEventSource(objectLockQueue);

    objectLockHandler.addEventSource(eventSource);

    auditBucket.addEventNotification(EventType.OBJECT_CREATED, new SqsDestination(objectLockQueue), {
      prefix: auditPrefix,
    });
  }
}
