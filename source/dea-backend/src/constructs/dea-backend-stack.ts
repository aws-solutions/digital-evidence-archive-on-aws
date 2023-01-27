/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { Aws, CfnOutput, CfnResource, RemovalPolicy, StackProps, Duration } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket, LifecycleRule } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { getConstants } from '../constants';

interface IBackendStackProps extends StackProps {
  kmsKey: Key;
}

export class DeaBackendConstruct extends Construct {
  public deaTable: Table;
  public datasetsBucket: Bucket;
  public accessLogsBucket: Bucket;

  public constructor(scope: Construct, id: string, props: IBackendStackProps) {
    super(scope, id);

    this.deaTable = this._createDeaTable(props.kmsKey);
    this.accessLogsBucket = this._createAccessLogsBucket(props.kmsKey, `${scope.node.id}-DeaS3AccessLogs`);
    this.datasetsBucket = this._createDatasetsBucket(
      props.kmsKey,
      this.accessLogsBucket,
      `${scope.node.id}-DeaS3Datasets`
    );
  }

  private _createDeaTable(key: Key): Table {
    const deaTable = new Table(this, 'DeaTable', {
      tableName: 'DeaTable',
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

    const tableNode = deaTable.node.defaultChild;
    if (tableNode instanceof CfnResource) {
      tableNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W28',
            reason: 'Table requires an explicit name to be referenced by Onetable',
          },
        ],
      });
    }

    return deaTable;
  }

  private _createAccessLogsBucket(key: Key, bucketNameOutput: string): Bucket {
    const { S3_UI_ACCESS_LOG_PREFIX, S3_DATASETS_ACCESS_LOG_PREFIX } = getConstants();

    const s3AccessLogsBucket = new Bucket(this, 'S3AccessLogsBucket', {
      autoDeleteObjects: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS,
      encryptionKey: key,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false, // https://github.com/awslabs/aws-solutions-constructs/issues/44
    });

    s3AccessLogsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [
          `${s3AccessLogsBucket.bucketArn}/${S3_UI_ACCESS_LOG_PREFIX}*`,
          `${s3AccessLogsBucket.bucketArn}/${S3_DATASETS_ACCESS_LOG_PREFIX}*`,
        ],
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

    new CfnOutput(this, bucketNameOutput, {
      value: s3AccessLogsBucket.bucketName,
      exportName: bucketNameOutput,
    });
    return s3AccessLogsBucket;
  }

  private _createDatasetsBucket(key: Key, accessLogBucket: Bucket, bucketNameOutput: string): Bucket {
    const { S3_DATASETS_ACCESS_LOG_PREFIX } = getConstants();

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
      serverAccessLogsPrefix: S3_DATASETS_ACCESS_LOG_PREFIX,

      // cors: TODO: we need to add cors and bucket policy for security/compliance
    });

    const datasetsBucketNode = datasetsBucket.node.defaultChild;
    if (datasetsBucketNode instanceof CfnBucket) {
      datasetsBucketNode.addPropertyOverride('ObjectLockEnabled', true);
    }
    new CfnOutput(this, bucketNameOutput, {
      value: datasetsBucket.bucketName,
      exportName: bucketNameOutput,
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
