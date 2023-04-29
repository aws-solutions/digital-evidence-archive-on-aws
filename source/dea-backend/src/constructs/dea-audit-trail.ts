/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { StackProps } from 'aws-cdk-lib';
import * as CloudTrail from 'aws-cdk-lib/aws-cloudtrail';
import { CfnTrail, ReadWriteType } from 'aws-cdk-lib/aws-cloudtrail';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
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

  public constructor(scope: Construct, stackName: string, props: DeaAuditProps) {
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

    const trail = new CloudTrail.Trail(scope, 'deaTrail', {
      bucket: trailBucket,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: trailLogGroup,
      encryptionKey: kmsKey,
    });

    const cfnTrail = trail.node.defaultChild;
    if (cfnTrail instanceof CfnTrail) {
      cfnTrail.eventSelectors = [
        {
          includeManagementEvents: true,
          readWriteType: ReadWriteType.ALL,
          dataResources: [
            {
              type: 'AWS::DynamoDB::Table',
              // data plane events for the DEA dynamo table
              values: [deaTableArn],
            },
            {
              type: 'AWS::S3::Object',
              // data plane events for the datasets bucket only
              values: [`${deaDatasetsBucket.bucketArn}/`],
            },
            {
              type: 'AWS::Lambda::Function',
              // data plane events for our lambdas
              values: ['arn:aws:lambda'],
            },
          ],
        },
      ];
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
}
