/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import ErrorPrefixes from '@aws/dea-app/lib/app/error-prefixes';
import { restrictAccountStatementStatementProps } from '@aws/dea-app/lib/storage/restrict-account-statement';
import * as glue from '@aws-cdk/aws-glue-alpha';
import { Aws, Duration, Fn, RemovalPolicy, StackProps, aws_kinesisfirehose } from 'aws-cdk-lib';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { CfnTable } from 'aws-cdk-lib/aws-glue';
import { ArnPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, LogGroup, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  IBucket,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { auditGlueTableColumns } from './audit-glue-table-columns';
import createAuditRedrivePolicy from './audit-redrive-policy';
import { subscriptionFilter } from './cloudtrail-filters';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';
import { FirehoseDestination } from './firehose-destination';

interface AuditCloudwatchToAthenaProps extends StackProps {
  readonly kmsKey: Key;
  readonly auditLogGroup: LogGroup;
  readonly trailLogGroup: LogGroup;
  readonly accessLogsBucket: IBucket;
  readonly opsDashboard?: DeaOperationalDashboard;
}

export class AuditCloudwatchToAthenaInfra extends Construct {
  public athenaTableName: string;
  public athenaDBName: string;
  public athenaWorkGroupName: string;
  public athenaOutputBucket: Bucket;
  public athenaAuditBucket: Bucket;
  public auditPrefix: string;

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
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'audit-bucket-access-logs',
      objectLockEnabled: true,
    });

    createCfnOutput(this, 'auditBucketName', {
      value: this.athenaAuditBucket.bucketName,
    });

    this.auditPrefix = 'audit/';

    const queryResultBucket = new Bucket(this, 'queryResultBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      versioned: true,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'query-result-bucket-access-logs',
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.retainPolicy() === RemovalPolicy.DESTROY,
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
        engineVersion: {
          selectedEngineVersion: 'Athena engine version 3',
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
    fireHosetoS3Role.addToPolicy(new PolicyStatement(restrictAccountStatementStatementProps));
    props.kmsKey.grantEncrypt(fireHosetoS3Role);

    const auditTransformLambda = new NodejsFunction(this, 'audit-processing-lambda', {
      // Our kinesis hint is 1MB, assume a high decompression of 10x, 512mb will be plenty
      memorySize: 512,
      // transformation lambda has a maximum execution of 5 minutes
      timeout: Duration.minutes(5),
      runtime: Runtime.NODEJS_18_X,
      tracing: Tracing.ACTIVE,
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
        prefix: this.auditPrefix,
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

    const fhoseArn = Fn.getAtt(fhose.logicalId, 'Arn').toString();

    auditTransformLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['firehose:PutRecordBatch'],
        resources: [fhoseArn],
      })
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cfnRole = auditTransformLambda.node.defaultChild as CfnFunction | undefined;
    cfnRole?.addOverride('DependsOn', undefined);

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
      filterPattern: subscriptionFilter,
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

    // create a policy for use in audit redrive
    createAuditRedrivePolicy(
      this,
      athenaWorkgroup,
      fhose,
      props.auditLogGroup,
      props.trailLogGroup,
      queryResultBucket,
      this.athenaAuditBucket,
      glueDB.databaseName,
      glueTable.tableName,
      props.kmsKey
    );

    props.kmsKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:GenerateDataKey*'],
        principals: [new ArnPrincipal(fireHosetoS3Role.roleArn)],
        resources: ['*'],
        sid: 'Allow Firehose Key access',
      })
    );
  }
}
