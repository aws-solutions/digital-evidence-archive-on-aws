/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { CfnOutput, Duration, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { getConstants } from './constants';

export class DEAUIStack extends Stack {
  public distributionEnvVars: {
    STAGE: string;
    STACK_NAME: string;
    API_BASE_URL: string;
    AWS_REGION: string;
    S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY: string;
    S3_ARTIFACT_BUCKET_NAME: string;
    S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME: string;
    ACCESS_IDENTITY_ARTIFACT_NAME: string;
  };
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: StackProps) {
    const {
      STAGE,
      STACK_NAME,
      API_BASE_URL,
      AWS_REGION,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_NAME,
      S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
      ACCESS_IDENTITY_ARTIFACT_NAME,
    } = getConstants();
    super(scope, STACK_NAME, {
      env: {
        region: AWS_REGION
      }
    });

    this.distributionEnvVars = {
      STAGE,
      STACK_NAME,
      API_BASE_URL,
      AWS_REGION,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_NAME,
      S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
      ACCESS_IDENTITY_ARTIFACT_NAME,
    };
    const bucket = this._createS3Bucket(S3_ARTIFACT_BUCKET_NAME, S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY);
    // const distribution = this._createDistribution(bucket);
    this._deployS3Bucket(bucket);
  }

  private _addS3TLSSigV4BucketPolicy(s3Bucket: Bucket): void {
    s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: 'Deny requests that do not use TLS/HTTPS',
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['s3:*'],
        resources: [s3Bucket.bucketArn, `${s3Bucket.bucketArn}/*`],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false'
          }
        }
      })
    );
    s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: 'Deny requests that do not use SigV4',
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['s3:*'],
        resources: [`${s3Bucket.bucketArn}/*`],
        conditions: {
          StringNotEquals: {
            's3:signatureversion': 'AWS4-HMAC-SHA256'
          }
        }
      })
    );
  }

  private _createS3Bucket(bucketName: string, outputKey: string): Bucket {
    const { S3_ACCESS_LOGS_BUCKET_PREFIX, S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY } = getConstants();
    const accessLogsBucketName: string = Fn.importValue(S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY);
    const accessLogsBucket = Bucket.fromBucketName(
      this,
      'imported-access-logs-bucket',
      accessLogsBucketName
    ) as Bucket;
    const s3Bucket = new Bucket(this, bucketName, {
      accessControl: BucketAccessControl.PRIVATE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: S3_ACCESS_LOGS_BUCKET_PREFIX,
      encryption: BucketEncryption.S3_MANAGED
    });

    this._addS3TLSSigV4BucketPolicy(s3Bucket);

    // eslint-disable-next-line no-new
    new CfnOutput(this, outputKey, {
      value: s3Bucket.bucketArn
    });
    return s3Bucket;
  }

  private _deployS3Bucket(bucket: Bucket): void {
    // eslint-disable-next-line no-new
    new BucketDeployment(this, this.distributionEnvVars.S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME, {
      destinationBucket: bucket,
      sources: [Source.asset(path.resolve(__dirname, '../../out'))],
    });
  }
}
