/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-new */
import assert from 'assert';
import * as path from 'path';
import { deaConfig } from '@aws/dea-backend/lib/config';
import { addLambdaSuppressions } from '@aws/dea-backend/lib/helpers/nag-suppressions';
import { Aws, CfnResource, NestedStack, RemovalPolicy, StackProps } from 'aws-cdk-lib';
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
import { generateSri } from './generate-subresource-integrity';

interface IUiStackProps extends StackProps {
  readonly kmsKey: Key;
  readonly restApi: RestApi;
  readonly accessLogsBucket: Bucket;
  readonly accessLogPrefix: string;
}

export class DeaUiConstruct extends NestedStack {
  private uiArtifactPath: string;
  private sriString: string;
  public bucket: Bucket;

  public constructor(scope: Construct, id: string, props: IUiStackProps) {
    super(scope, 'DeaUiStack');

    this.bucket = new Bucket(this, 'ui-artifact-bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      encryption: BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: props.accessLogPrefix,
      removalPolicy: deaConfig.retainPolicy(),
      autoDeleteObjects: deaConfig.retainPolicy() === RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    this.addS3TLSSigV4BucketPolicy(this.bucket);

    this.uiArtifactPath = path.resolve(__dirname, '../../ui/out');

    this.sriString = generateSri(this.uiArtifactPath, 'sha384').join("' '");

    let sources = [Source.asset(this.uiArtifactPath)];
    if (deaConfig.isOneClick()) {
      const DIST_BUCKET = process.env.DIST_OUTPUT_BUCKET ?? assert(false);
      const DIST_VERSION = process.env.DIST_VERSION || '%%VERSION%%';

      const solutionsBucketName = `${DIST_BUCKET}-${Aws.REGION}`;

      const solutionsBucket = Bucket.fromBucketName(this, 'solutions-bucket', solutionsBucketName);

      sources = [Source.bucket(solutionsBucket, `digital-evidence-archive/${DIST_VERSION}/ui.zip`)];
    }
    // eslint-disable-next-line no-new
    new BucketDeployment(this, 'artifact-deployment-bucket', {
      destinationBucket: this.bucket,
      sources,
    });

    const executeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    this.bucket.grantReadWrite(executeRole);

    this.routeHandler(props, this.bucket, executeRole);

    const lambdaToSuppress = this.node.findChild(
      'Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C'
    ).node.defaultChild;
    if (lambdaToSuppress instanceof CfnResource) {
      addLambdaSuppressions(lambdaToSuppress);
    }
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

    // /data-vaults page
    const dataVaultsResource = uiResource.addResource('data-vaults');
    const dataVaultsS3Integration = this.getS3Integration('data-vaults.html', bucket, executeRole);
    dataVaultsResource.addMethod('GET', dataVaultsS3Integration, this.getMethodOptions());

    // /data-vault-detail page
    const dataVaultDetailResource = uiResource.addResource('data-vault-detail');
    const dataVaultDetailS3Integration = this.getS3Integration('data-vault-detail.html', bucket, executeRole);
    dataVaultDetailResource.addMethod('GET', dataVaultDetailS3Integration, this.getMethodOptions());

    // /create-data-vaults page
    const createDataVaultsResource = uiResource.addResource('create-data-vaults');
    const createDataVaultsS3Integration = this.getS3Integration(
      'create-data-vaults.html',
      bucket,
      executeRole
    );
    createDataVaultsResource.addMethod('GET', createDataVaultsS3Integration, this.getMethodOptions());

    // /edit-data-vault page
    const editDataVaultResource = uiResource.addResource('edit-data-vault');
    const editDataVaultS3Integration = this.getS3Integration('edit-data-vault.html', bucket, executeRole);
    editDataVaultResource.addMethod('GET', editDataVaultS3Integration, this.getMethodOptions());

    // /data-sync-tasks page
    const dataSyncTasksResource = uiResource.addResource('data-sync-tasks');
    const dataSyncTasksS3Integration = this.getS3Integration('data-sync-tasks.html', bucket, executeRole);
    dataSyncTasksResource.addMethod('GET', dataSyncTasksS3Integration, this.getMethodOptions());

    // /data-vault-file-detail page
    const dataVaultFileDetailResource = uiResource.addResource('data-vault-file-detail');
    const dataVaultFileDetailS3Integration = this.getS3Integration(
      'data-vault-file-detail.html',
      bucket,
      executeRole
    );
    dataVaultFileDetailResource.addMethod('GET', dataVaultFileDetailS3Integration, this.getMethodOptions());
  }

  private getS3Integration(path: string, bucket: Bucket, executeRole: Role): AwsIntegration {
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
              'method.response.header.Content-Security-Policy':
                `'default-src 'self';` +
                `img-src 'self' blob: data:;` +
                `style-src 'unsafe-inline' 'self';` +
                `connect-src 'self' https://*.amazoncognito.com https://*.amazonaws.com;` +
                `script-src 'strict-dynamic' '${this.sriString}';` +
                `font-src 'self' data:;` +
                `base-uri 'self';` +
                `object-src 'none';` +
                `block-all-mixed-content;'`,
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
