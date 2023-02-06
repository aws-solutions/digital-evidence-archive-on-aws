/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { Aws, RemovalPolicy, StackProps, Duration } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket, LifecycleRule } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { createCfnOutput } from './construct-support';

interface IBackendStackProps extends StackProps {
  readonly kmsKey: Key;
  readonly accessLogsPrefixes: ReadonlyArray<string>;
}

export class DeaBackendConstruct extends Construct {
  public deaTable: Table;
  public datasetsBucket: Bucket;
  public accessLogsBucket: Bucket;

  public constructor(scope: Construct, id: string, props: IBackendStackProps) {
    super(scope, id);

    this.deaTable = this._createDeaTable(props.kmsKey);
    const datasetsPrefix = 'dea-datasets-access-log';
    const prefixes = props.accessLogsPrefixes.concat([datasetsPrefix]);
    this.accessLogsBucket = this._createAccessLogsBucket(`${scope.node.id}-DeaS3AccessLogs`, prefixes);
    this.datasetsBucket = this._createDatasetsBucket(
      props.kmsKey,
      this.accessLogsBucket,
      `${scope.node.id}-DeaS3Datasets`,
      datasetsPrefix,
    );
  }

  private _createDeaTable(key: Key): Table {
    const deaTable = new Table(this, 'DeaTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      //should probably be RETAIN later
      removalPolicy: RemovalPolicy.DESTROY,
      sortKey: { name: 'SK', type: AttributeType.STRING },
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecovery: true,
    });

    deaTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      projectionType: ProjectionType.ALL,
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    });

    deaTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      projectionType: ProjectionType.ALL,
      partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
    });

    return deaTable;
  }

  private _createAccessLogsBucket(
    bucketNameOutput: Readonly<string>,
    accessLogPrefixes: ReadonlyArray<string>
  ): Bucket {
    const s3AccessLogsBucket = new Bucket(this, 'S3AccessLogsBucket', {
      autoDeleteObjects: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false, // https://github.com/awslabs/aws-solutions-constructs/issues/44
    });

    const resources = accessLogPrefixes.map(prefix => `${s3AccessLogsBucket.bucketArn}/${prefix}*`);

    s3AccessLogsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources,
        conditions: {
          StringEquals: {
            'aws:SourceAccount': Aws.ACCOUNT_ID,
          },
        },
      })
    );

    //CFN NAG Suppression
    const s3AccessLogsBucketNode = s3AccessLogsBucket.node.defaultChild;
    if (s3AccessLogsBucketNode instanceof CfnBucket) {
      s3AccessLogsBucketNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W35',
            reason:
              "This is an access log bucket, we don't need to configure access logging for access log buckets",
          },
        ],
      });
    }

    createCfnOutput(this, bucketNameOutput, {
      value: s3AccessLogsBucket.bucketName,
    });
    return s3AccessLogsBucket;
  }

  private _createDatasetsBucket(
    key: Readonly<Key>,
    accessLogBucket: Readonly<Bucket>,
    bucketNameOutput: Readonly<string>,
    accessLogPrefix: Readonly<string>,
  ): Bucket {
    const datasetsBucket = new Bucket(this, 'S3DatasetsBucket', {
      autoDeleteObjects: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS,
      encryptionKey: key,
      enforceSSL: true,
      lifecycleRules: this._getLifeCycleRules(),
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: accessLogPrefix,

      // cors: TODO: we need to add cors and bucket policy for security/compliance
    });

    const datasetsBucketNode = datasetsBucket.node.defaultChild;
    if (datasetsBucketNode instanceof CfnBucket) {
      datasetsBucketNode.addPropertyOverride('ObjectLockEnabled', true);
    }
    createCfnOutput(this, bucketNameOutput, {
      value: datasetsBucket.bucketName,
    });

    return datasetsBucket;
  }

  private _getLifeCycleRules(): LifecycleRule[] {
    const deleteIncompleteUploadsRule: LifecycleRule = {
      abortIncompleteMultipartUploadAfter: Duration.days(1),
      enabled: true,
      id: 'DeaDatasetsDeleteIncompleteUploadsLifecyclePolicy',
    };

    return [deleteIncompleteUploadsRule];
  }
}
