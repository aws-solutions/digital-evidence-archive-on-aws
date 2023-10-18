/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { Aws, StackProps, Duration, CfnResource } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  CfnBucket,
  LifecycleRule,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';

interface IBackendStackProps extends StackProps {
  readonly kmsKey: Key;
  readonly accessLogsPrefixes: ReadonlyArray<string>;
  readonly opsDashboard?: DeaOperationalDashboard;
}

export class DeaBackendConstruct extends Construct {
  public deaTable: Table;
  public datasetsBucket: Bucket;
  public accessLogsBucket: Bucket;
  public datasetsDataSyncRole: Role;
  public dataSyncLogsBucket: Bucket;
  public dataSyncLogsBucketRole: Role;

  public constructor(
    scope: Construct,
    id: string,
    protectedDeaResourceArns: string[],
    props: IBackendStackProps
  ) {
    super(scope, id);

    this.deaTable = this.createDeaTable(props.kmsKey);
    const datasetsPrefix = 'dea-datasets-access-log';
    const prefixes = props.accessLogsPrefixes.concat([datasetsPrefix]);
    this.accessLogsBucket = this.createAccessLogsBucket(`DeaS3AccessLogs`, prefixes);
    this.datasetsBucket = this.createDatasetsBucket(
      props.kmsKey,
      this.accessLogsBucket,
      `DeaS3Datasets`,
      datasetsPrefix
    );
    this.datasetsDataSyncRole = this.createDatasetsBucketAccessRole(props.kmsKey);
    this.dataSyncLogsBucket = this.createDataSyncLogsBucket();
    this.dataSyncLogsBucketRole = this.createDataSyncLogsBucketRole(this.dataSyncLogsBucket.bucketArn);

    props.opsDashboard?.addDynamoTableOperationalComponents(this.deaTable);

    protectedDeaResourceArns.push(this.deaTable.tableArn);
    protectedDeaResourceArns.push(this.datasetsBucket.bucketArn);
    protectedDeaResourceArns.push(this.datasetsBucket.arnForObjects('*'));
    protectedDeaResourceArns.push(this.accessLogsBucket.bucketArn);
    protectedDeaResourceArns.push(this.accessLogsBucket.arnForObjects('*'));
  }

  private createDeaTable(key: Key): Table {
    const deaTable = new Table(this, 'DeaTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      removalPolicy: deaConfig.retainPolicy(),
      sortKey: { name: 'SK', type: AttributeType.STRING },
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
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

  private createAccessLogsBucket(
    bucketNameOutput: Readonly<string>,
    accessLogPrefixes: ReadonlyArray<string>
  ): Bucket {
    const s3AccessLogsBucket = new Bucket(this, 'S3AccessLogsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      versioned: false, // https://github.com/awslabs/aws-solutions-constructs/issues/44,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    createCfnOutput(this, 'S3AccessLogsBucketName', {
      value: s3AccessLogsBucket.bucketName,
    });

    const resources = accessLogPrefixes.map((prefix) => `${s3AccessLogsBucket.bucketArn}/${prefix}*`);

    s3AccessLogsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
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

    const s3AccessLogsBucketPolicyNode = s3AccessLogsBucket.node.findChild('Policy').node.defaultChild;
    if (s3AccessLogsBucketPolicyNode instanceof CfnResource) {
      s3AccessLogsBucketPolicyNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'F16',
            reason: 'S3 Bucket Policy * is used on Deny',
          },
        ],
      });
    }

    createCfnOutput(this, bucketNameOutput, {
      value: s3AccessLogsBucket.bucketName,
    });

    return s3AccessLogsBucket;
  }

  private createDatasetsBucket(
    key: Readonly<Key>,
    accessLogBucket: Readonly<Bucket>,
    bucketNameOutput: Readonly<string>,
    accessLogPrefix: Readonly<string>
  ): Bucket {
    const datasetsBucket = new Bucket(this, 'S3DatasetsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS,
      encryptionKey: key,
      enforceSSL: true,
      lifecycleRules: this.getLifeCycleRules(),
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      versioned: true,
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: accessLogPrefix,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.HEAD],
          allowedHeaders: ['*'],
        },
      ],
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const datasetsBucketNode = datasetsBucket.node.defaultChild;
    if (datasetsBucketNode instanceof CfnBucket) {
      datasetsBucketNode.addPropertyOverride('ObjectLockEnabled', true);
    }
    createCfnOutput(this, bucketNameOutput, {
      value: datasetsBucket.bucketName,
    });

    //CFN NAG Suppression
    const datasetsBucketPolicyNode = datasetsBucket.node.findChild('Policy').node.defaultChild;
    if (datasetsBucketPolicyNode instanceof CfnResource) {
      datasetsBucketPolicyNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'F16',
            reason: 'S3 Bucket Policy * is used on Deny',
          },
        ],
      });
    }

    return datasetsBucket;
  }

  private createDatasetsBucketAccessRole(kmsKey: Key): Role {
    const role = new Role(this, 'DataSyncPermissionsRole', {
      assumedBy: new ServicePrincipal('datasync.amazonaws.com'),
    });

    const policyStatements: PolicyStatement[] = [
      new PolicyStatement({
        actions: ['s3:GetBucketLocation', 's3:ListBucket', 's3:ListBucketMultipartUploads'],
        effect: Effect.ALLOW,
        resources: [this.datasetsBucket.bucketArn],
      }),
      new PolicyStatement({
        actions: [
          's3:AbortMultipartUpload',
          's3:GetObject',
          's3:ListMultipartUploadParts',
          's3:PutObjectTagging',
          's3:GetObjectTagging',
          's3:PutObject',
          's3:ListObjectsV2',
        ],
        effect: Effect.ALLOW,
        resources: [`${this.datasetsBucket.bucketArn}/*`],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [kmsKey.keyArn],
      }),
      // DataSync stores temporary objects in S3 to facilitate transfers
      // These objects are stored under .aws-datasync/ prefix.
      // Allow for object deletion only in that prefix
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:DeleteObject'],
        resources: [`${this.datasetsBucket.bucketArn}*/.aws-datasync/*`],
      }),
    ];

    // Attach the policy statements to the role
    policyStatements.forEach((statement) => {
      role.addToPolicy(statement);
    });

    createCfnOutput(this, 'DeaDataSyncRole', {
      value: role.roleArn,
    });

    return role;
  }

  private createDataSyncLogsBucket() {
    const datasyncLogBucket = new Bucket(this, 'deaDataSyncReportsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      versioned: false, // https://github.com/awslabs/aws-solutions-constructs/issues/44,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    createCfnOutput(this, 'DeaDataSyncReportsBucketName', {
      value: datasyncLogBucket.bucketName,
    });

    return datasyncLogBucket;
  }

  private createDataSyncLogsBucketRole(bucketArn: string) {
    const role = new Role(this, 'deaDataSyncLogsBucketRole', {
      assumedBy: new ServicePrincipal('datasync.amazonaws.com'),
    });

    const policyStatement = new PolicyStatement({
      actions: ['s3:PutObject'],
      effect: Effect.ALLOW,
      resources: [`${bucketArn}/*`],
      conditions: {
        StringEquals: {
          's3:ResourceAccount': Aws.ACCOUNT_ID,
        },
      },
    });

    role.addToPolicy(policyStatement);

    createCfnOutput(this, 'DeaDataSyncReportsRole', {
      value: role.roleArn,
    });

    return role;
  }

  private getLifeCycleRules(): LifecycleRule[] {
    const deleteIncompleteUploadsRule: LifecycleRule = {
      abortIncompleteMultipartUploadAfter: Duration.days(1),
      enabled: true,
      id: 'DeaDatasetsDeleteIncompleteUploadsLifecyclePolicy',
    };

    return [deleteIncompleteUploadsRule];
  }
}
