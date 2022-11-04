/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { Stack, StackProps } from 'aws-cdk-lib';
import {
  AwsIntegration,
  ContentHandling,
  MethodOptions,
  Model,
  PassthroughBehavior,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { getConstants } from './constants';

export class DeaUiStack extends Stack {
  public distributionEnvVars: {
    STAGE: string;
    STACK_NAME: string;
    API_BASE_URL: string;
    AWS_REGION: string;
    S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY: string;
    S3_ARTIFACT_BUCKET_NAME: string;
    S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME: string;
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
    } = getConstants();
    super(scope, STACK_NAME, {
      env: {
        region: AWS_REGION,
      },
    });

    this.distributionEnvVars = {
      STAGE,
      STACK_NAME,
      API_BASE_URL,
      AWS_REGION,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_NAME,
      S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
    };

    const bucket = new Bucket(this, S3_ARTIFACT_BUCKET_NAME, {
      accessControl: BucketAccessControl.PRIVATE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
    });

    // eslint-disable-next-line no-new
    new BucketDeployment(this, this.distributionEnvVars.S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME, {
      destinationBucket: bucket,
      sources: [Source.asset(path.resolve(__dirname, '../../ui/out'))],
    });

    const executeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    bucket.grantReadWrite(executeRole);

    const api = new RestApi(this, 'dea-ui-gateway', {
      description: 'distribution api',
    });

    const rootS3Integration = this._getS3Integration('index.html', bucket, executeRole);
    // GET to the root
    api.root.addMethod('GET', rootS3Integration, this._getMethodOptions());

    // GET to /{proxy+}
    const proxy = api.root.addProxy({ anyMethod: false });
    const proxyS3Integration = this._getS3Integration('{proxy}', bucket, executeRole);
    proxy.addMethod('GET', proxyS3Integration, this._getMethodOptions());
  }

  private _getS3Integration(path: string, bucket: Bucket, executeRole: Role): AwsIntegration {
    return new AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'GET',
      path: `${bucket.bucketName}/${path}`,
      options: {
        credentialsRole: executeRole,
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
          'integration.request.header.Accept': 'method.request.header.Accept',
          'integration.request.header.Content-Type': 'method.request.header.Content-Type',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            },
          },
        ],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        contentHandling: ContentHandling.CONVERT_TO_TEXT,
      },
    });
  }

  private _getMethodOptions(): MethodOptions {
    return {
      requestParameters: {
        'method.request.path.proxy': true,
        'method.request.header.Accept': true,
        'method.request.header.Content-Type': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': Model.EMPTY_MODEL,
          },
          responseParameters: {
            'method.response.header.Content-Length': true,
            'method.response.header.Content-Type': true,
          },
        },
      ],
    };
  }
}
