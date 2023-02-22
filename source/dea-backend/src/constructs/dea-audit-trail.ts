/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { StackProps } from 'aws-cdk-lib';
import * as CloudTrail from 'aws-cdk-lib/aws-cloudtrail';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { deaConfig } from '../config';

interface DeaAuditProps extends StackProps {
  readonly kmsKey: Key;
}

export class DeaAuditTrail extends Construct {
  public auditTrail: CloudTrail.Trail;
  public auditLogGroup: LogGroup;
  public trailLogGroup: LogGroup;

  public constructor(scope: Construct, stackName: string, props: DeaAuditProps) {
    super(scope, stackName);

    this.auditLogGroup = this._createLogGroup(scope, 'deaAuditLogs', props.kmsKey);
    this.trailLogGroup = this._createLogGroup(scope, 'deaTrailLogs', props.kmsKey);
    this.auditTrail = this._createAuditTrail(scope, this.trailLogGroup, props.kmsKey);
    props.kmsKey.grantEncrypt(new ServicePrincipal('cloudtrail.amazonaws.com'));
  }

  private _createAuditTrail(scope: Construct, trailLogGroup: LogGroup, kmsKey: Key) {
    const trailBucket = new Bucket(this, 'deaTrailBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: kmsKey,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
    });

    return new CloudTrail.Trail(scope, 'deaTrail', {
      bucket: trailBucket,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: trailLogGroup,
      encryptionKey: kmsKey,
    });
  }

  private _createLogGroup(scope: Construct, id: string, kmsKey: Key) {
    return new LogGroup(scope, id, {
      encryptionKey: kmsKey,
      retention: deaConfig.retentionDays(),
      removalPolicy: deaConfig.retainPolicy(),
    });
  }
}
