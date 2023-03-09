/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-new */
import * as path from 'path';
import { deaConfig } from '@aws/dea-backend';
import { StackProps } from 'aws-cdk-lib';
import {
  AuthorizationType,
  AwsIntegration,
  ContentHandling,
  MethodOptions,
  Model,
  PassthroughBehavior,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface IUiStackProps extends StackProps {
  readonly kmsKey: Key;
  readonly restApi: RestApi;
  readonly accessLogsBucket: Bucket;
  readonly accessLogPrefix: string;
}

export class DeaUiConstruct extends Construct {
  public constructor(scope: Construct, id: string, props: IUiStackProps) {
    super(scope, 'DeaUiStack');

    const bucket = new Bucket(this, 'artifact-bucket', {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      encryption: BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: props.accessLogPrefix,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
    });

    this._addS3TLSSigV4BucketPolicy(bucket);

    // eslint-disable-next-line no-new
    new BucketDeployment(this, 'artifact-deployment-bucket', {
      destinationBucket: bucket,
      sources: [Source.asset(path.resolve(__dirname, '../../ui/out'))],
    });

    const executeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    bucket.grantReadWrite(executeRole);

    // Integrate API with S3 bucket
    const uiResource = props.restApi.root.addResource('ui');
    const rootS3Integration = this._getS3Integration('index.html', bucket, executeRole);

    // GET to the root
    uiResource.addMethod('GET', rootS3Integration, this._getMethodOptions());

    // GET to /Login
    // Add a new resource to the ui for login page
    const loginResource = uiResource.addResource('login');

    // Add a GET method to the "login" resource with an S3 integration
    const loginS3Integration = this._getS3Integration('login.html', bucket, executeRole);
    loginResource.addMethod('GET', loginS3Integration, this._getMethodOptions());

    // GET to /auth-test
    // Add a new resource to the ui for login page
    const authTestResource = uiResource.addResource('auth-test');

    // Add a GET method to the "login" resource with an S3 integration
    const authTestIntegration = this._getS3Integration('auth-test.html', bucket, executeRole);
    authTestResource.addMethod('GET', authTestIntegration, this._getMethodOptions());

    // GET to /{proxy+}
    const proxy = uiResource.addProxy({ anyMethod: false });
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
      authorizationType: AuthorizationType.NONE,
    };
  }

  private _addS3TLSSigV4BucketPolicy(s3Bucket: Bucket): void {
    s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: 'Deny requests that do not use TLS/HTTPS',
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['s3:*'],
        resources: [s3Bucket.bucketArn, s3Bucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );
    s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: 'Deny requests that do not use SigV4',
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['s3:*'],
        resources: [s3Bucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:signatureversion': 'AWS4-HMAC-SHA256',
          },
        },
      })
    );
  }
}
