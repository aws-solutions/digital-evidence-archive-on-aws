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
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
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
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      encryption: BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: props.accessLogPrefix,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.isTestStack(),
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    this.addS3TLSSigV4BucketPolicy(bucket);

    let sources = [Source.asset(path.resolve(__dirname, '../../ui/out'))];
    if (deaConfig.isOneClick()) {
      const solutionsBucketName = 'solutions-features';

      const solutionsBucket = Bucket.fromBucketName(this, 'solutions-bucket', solutionsBucketName);

      sources = [Source.bucket(solutionsBucket, 'digital-evidence-archive/v1.0.0/ui.zip')];
    }
    // eslint-disable-next-line no-new
    new BucketDeployment(this, 'artifact-deployment-bucket', {
      destinationBucket: bucket,
      sources,
    });

    const executeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    bucket.grantReadWrite(executeRole);

    this.routeHandler(props, bucket, executeRole);
  }

  private routeHandler(props: IUiStackProps, bucket: Bucket, executeRole: Role) {
    // Integrate API with S3 bucket

    // /ui - homepage
    const uiResource = props.restApi.root.addResource('ui');
    const rootS3Integration = this.getS3Integration('index.html', bucket, executeRole);
    uiResource.addMethod('GET', rootS3Integration, this.getMethodOptions());

    // /Login
    const loginResource = uiResource.addResource('login');
    const loginS3Integration = this.getS3Integration('login.html', bucket, executeRole);
    loginResource.addMethod('GET', loginS3Integration, this.getMethodOptions());

    // /case-detail
    const caseDetailResource = uiResource.addResource('case-detail');
    const caseDetailS3Integration = this.getS3Integration('case-detail.html', bucket, executeRole);
    caseDetailResource.addMethod('GET', caseDetailS3Integration, this.getMethodOptions());

    // /create-cases
    const createCasesResource = uiResource.addResource('create-cases');
    const createCasesS3Integration = this.getS3Integration('create-cases.html', bucket, executeRole);
    createCasesResource.addMethod('GET', createCasesS3Integration, this.getMethodOptions());

    // /upload-file
    const uploadFilesResource = uiResource.addResource('upload-files');
    const uploadFilesS3Integration = this.getS3Integration('upload-files.html', bucket, executeRole);
    uploadFilesResource.addMethod('GET', uploadFilesS3Integration, this.getMethodOptions());

    // /auth-test page
    const authTestResource = uiResource.addResource('auth-test');
    const authTestIntegration = this.getS3Integration('auth-test.html', bucket, executeRole);
    authTestResource.addMethod('GET', authTestIntegration, this.getMethodOptions());

    // GET to /{proxy+}
    const proxy = uiResource.addProxy({ anyMethod: false });
    const proxyS3Integration = this.getS3Integration('{proxy}', bucket, executeRole);
    proxy.addMethod('GET', proxyS3Integration, this.getMethodOptions());
  }

  private getS3Integration(path: string, bucket: Bucket, executeRole: Role): AwsIntegration {
    const deaCustomDomainInfo = deaConfig.customDomainInfo();
    const deaDomain = deaCustomDomainInfo.domainName
      ? `https://${deaCustomDomainInfo.domainName} https://*.amazonaws.com`
      : 'https://*.amazonaws.com';

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
              'method.response.header.Content-Security-Policy': `'default-src 'self'; img-src 'self' blob:; style-src 'unsafe-inline' 'self'; connect-src 'self' https://*.amazoncognito.com ${deaDomain}; script-src 'self'; font-src 'self' data:; block-all-mixed-content;'`,
              'method.response.header.Strict-Transport-Security': "'max-age=31540000; includeSubdomains'",
              'method.response.header.X-Content-Type-Options': "'nosniff'",
              'method.response.header.X-Frame-Options': "'DENY'",
              'method.response.header.X-XSS-Protection': "'1; mode=block'",
            },
          },
        ],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        contentHandling: ContentHandling.CONVERT_TO_TEXT,
      },
    });
  }

  private getMethodOptions(): MethodOptions {
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
            'method.response.header.Content-Security-Policy': true,
            'method.response.header.Strict-Transport-Security': true,
            'method.response.header.X-Content-Type-Options': true,
            'method.response.header.X-Frame-Options': true,
            'method.response.header.X-XSS-Protection': true,
          },
        },
      ],
      authorizationType: AuthorizationType.NONE,
    };
  }

  private addS3TLSSigV4BucketPolicy(s3Bucket: Bucket): void {
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
