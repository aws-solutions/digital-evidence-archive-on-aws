/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CfnResource, StackProps } from 'aws-cdk-lib';
import * as CloudTrail from 'aws-cdk-lib/aws-cloudtrail';
import { CfnTrail, ReadWriteType } from 'aws-cdk-lib/aws-cloudtrail';
import { Effect, PolicyStatement, ServicePrincipal, StarPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  CfnBucket,
  IBucket,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { deaConfig } from '../config';

interface DeaAuditProps extends StackProps {
  readonly kmsKey: Key;
  readonly deaDatasetsBucket: IBucket;
  readonly deaTableArn: string;
}

export class DeaAuditTrail extends Construct {
  public auditTrail: CloudTrail.Trail;
  public auditLogGroup: LogGroup;
  public trailLogGroup: LogGroup;

  public constructor(
    scope: Construct,
    stackName: string,
    protectedDeaResourceArns: string[],
    props: DeaAuditProps
  ) {
    super(scope, stackName);

    this.auditLogGroup = this.createLogGroup(scope, 'deaAuditLogs', props.kmsKey);

    this.trailLogGroup = this.createLogGroup(scope, 'deaTrailLogs', props.kmsKey);
    this.auditTrail = this.createAuditTrail(
      scope,
      this.trailLogGroup,
      props.kmsKey,
      props.deaDatasetsBucket,
      props.deaTableArn
    );
    props.kmsKey.grantEncrypt(new ServicePrincipal('cloudtrail.amazonaws.com'));

    // Nag Suppressions
    const auditLogsNode = this.auditLogGroup.node.defaultChild;
    if (auditLogsNode instanceof CfnResource) {
      this.retentionNagSuppresion(auditLogsNode);
    }

    const trailLogGroupResource = this.trailLogGroup.node.defaultChild;
    if (trailLogGroupResource instanceof CfnResource) {
      this.retentionNagSuppresion(trailLogGroupResource);
    }

    protectedDeaResourceArns.push(this.auditLogGroup.logGroupArn);
    protectedDeaResourceArns.push(this.trailLogGroup.logGroupArn);
    protectedDeaResourceArns.push(this.auditTrail.trailArn);
  }

  private createAuditTrail(
    scope: Construct,
    trailLogGroup: LogGroup,
    kmsKey: Key,
    deaDatasetsBucket: IBucket,
    deaTableArn: string
  ) {
    const trailBucket = new Bucket(this, 'deaTrailBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    if (!deaConfig.isTestStack()) {
      trailBucket.addToResourcePolicy(
        new PolicyStatement({
          effect: Effect.DENY,
          actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
          resources: [`${trailBucket.bucketArn}/*`],
          principals: [new StarPrincipal()],
          sid: 'accesslogs-deny-bucket-policy',
        })
      );

      trailBucket.addToResourcePolicy(
        new PolicyStatement({
          effect: Effect.DENY,
          actions: ['s3:PutLifecycleConfiguration'],
          resources: [trailBucket.bucketArn],
          principals: [new StarPrincipal()],
          sid: 'accesslogs-deny-bucket-policy',
        })
      );
    }

    //CFN NAG Suppression
    const trailBucketNode = trailBucket.node.defaultChild;
    if (trailBucketNode instanceof CfnBucket) {
      trailBucketNode.addMetadata('cfn_nag', {
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

    const trail = new CloudTrail.Trail(scope, 'deaTrail', {
      bucket: trailBucket,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: trailLogGroup,
      encryptionKey: kmsKey,
      isMultiRegionTrail: deaConfig.isMultiRegionTrail(),
    });

    // Currently, Amazon DDB API Activity Stream for CluodTrail Data Events
    // Is not available in gov cloud. https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/govcloud-ct.html
    // TODO: to make up for the hole in auditing, create a permissions boundary
    // that blocks access to the DDB table and the S3 evidence bucket
    // and put in the implementation guide that they can add this to the
    // IAM Roles for administrators/staff for the AWS account
    const dataResources = [
      {
        type: 'AWS::S3::Object',
        // data plane events for the datasets bucket only
        values: [`${deaDatasetsBucket.bucketArn}/`],
      },
    ];
    const partition = deaConfig.partition();

    const includeDynamoDBDataPlaneEvents =
      partition !== 'aws-us-gov' &&
      !deaConfig.isOneClick() &&
      deaConfig.includeDynamoDataPlaneEventsInTrail();

    if (includeDynamoDBDataPlaneEvents) {
      dataResources.push({
        type: 'AWS::DynamoDB::Table',
        // data plane events for the DEA dynamo table
        values: [deaTableArn],
      });

      dataResources.push({
        type: 'AWS::Lambda::Function',
        // data plane events for our lambdas
        values: ['arn:aws:lambda'],
      });
    }

    const cfnTrail = trail.node.defaultChild;
    if (cfnTrail instanceof CfnTrail) {
      cfnTrail.eventSelectors = [
        {
          includeManagementEvents: true,
          readWriteType: ReadWriteType.ALL,
          dataResources,
        },
      ];
    }

    //CFN Nag Suppressions
    const logsRoleNode = trail.node.findChild('LogsRole').node.defaultChild;
    if (logsRoleNode instanceof CfnResource) {
      this.retentionNagSuppresion(logsRoleNode);
    }

    return trail;
  }

  private createLogGroup(scope: Construct, id: string, kmsKey: Key) {
    return new LogGroup(scope, id, {
      encryptionKey: kmsKey,
      retention: deaConfig.retentionDays(),
      removalPolicy: deaConfig.retainPolicy(),
    });
  }

  private retentionNagSuppresion(resource: CfnResource) {
    resource.addMetadata('cfn_nag', {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      rules_to_suppress: [
        {
          id: 'W86',
          reason: 'Should not retain on test stacks',
        },
      ],
    });
  }
}
