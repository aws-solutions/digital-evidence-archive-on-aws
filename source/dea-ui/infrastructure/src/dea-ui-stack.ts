/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-new */
import * as path from 'path';
import { Aws, CfnOutput, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import {
  AwsIntegration,
  CfnDeployment,
  CfnStage,
  ContentHandling, MethodOptions,
  Model,
  PassthroughBehavior,
  RestApi
} from 'aws-cdk-lib/aws-apigateway';
import { AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  CfnBucket
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { getConstants } from './constants';

interface IUiStackProps extends StackProps {
  kmsKey: Key;
  restApi: RestApi;
}

export class DeaUiConstruct extends Construct {
  public distributionEnvVars: {
    STAGE: string;
    STACK_NAME: string;
    API_BASE_URL: string;
    AWS_REGION: string;
    S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY: string;
    S3_ARTIFACT_BUCKET_NAME: string;
    S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME: string;
  };

  private _accessLogsBucket: Bucket;
  private _s3AccessLogsPrefix: string;

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props: IUiStackProps) {
    const {
      STAGE,
      STACK_NAME,
      API_BASE_URL,
      AWS_REGION,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_NAME,
      S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
    } = getConstants();
    super(scope, STACK_NAME);

    this.distributionEnvVars = {
      STAGE,
      STACK_NAME,
      API_BASE_URL,
      AWS_REGION,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_NAME,
      S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
    };

    // Create Bucket for hosting UI assets and it's access log bucket
    this._s3AccessLogsPrefix = 'dea-ui-access-log';
    this._accessLogsBucket = this._createAccessLogsBucket('DeaUIS3BucketAccessLogsOutput');

    const bucket = new Bucket(this, S3_ARTIFACT_BUCKET_NAME, {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      encryption: BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: this._accessLogsBucket,
      serverAccessLogsPrefix: this._s3AccessLogsPrefix,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this._addS3TLSSigV4BucketPolicy(bucket);

    // eslint-disable-next-line no-new
    new BucketDeployment(this, this.distributionEnvVars.S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME, {
      destinationBucket: bucket,
      sources: [Source.asset(path.resolve(__dirname, '../../ui/out'))],
    });

    const executeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    bucket.grantReadWrite(executeRole);

    // Integrate API with S3 bucket
    const rootS3Integration = this._getS3Integration('index.html', bucket, executeRole);
    // GET to the root
    props.restApi.root.addMethod('GET', rootS3Integration, this._getMethodOptions());

    // GET to /{proxy+}
    const uiResource = props.restApi.root.addResource('ui');
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

  private _createAccessLogsBucket(bucketNameOutput: string): Bucket {
    const uiS3AccessLogsBucket = new Bucket(this, 'uiS3AccessLogsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    uiS3AccessLogsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('logging.s3.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [`${uiS3AccessLogsBucket.bucketArn}/${this._s3AccessLogsPrefix}*`],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': Aws.ACCOUNT_ID,
          },
        },
      })
    );

    //CFN NAG Suppression
    const uiS3AccessLogsBucketNode = uiS3AccessLogsBucket.node.defaultChild;
    if (uiS3AccessLogsBucketNode instanceof CfnBucket)
      uiS3AccessLogsBucketNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W35',
            reason:
              "This is an access log bucket, we don't need to configure access logging for access log buckets",
          },
        ],
      });

    new CfnOutput(this, bucketNameOutput, {
      value: uiS3AccessLogsBucket.bucketName,
      exportName: bucketNameOutput,
    });
    return uiS3AccessLogsBucket;
  }

  private _apiGwUiWarnSuppress(api: RestApi, stage: string): void {
    // Don't need usage plan for UI API GW
    const stageNode = api.node.findChild(`DeploymentStage.${stage}`).node.defaultChild;
    const apiNode = api.node.findChild('Deployment').node.defaultChild;
    if (apiNode instanceof CfnDeployment) {
      apiNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W68',
            reason: "'No need to enforce Usage Plan. This is only for serving UI' ",
          },
        ],
      });
    }

    if (stageNode instanceof CfnStage) {
      stageNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W64',
            reason: "'No need to enforce Usage Plan. This is only for serving UI' ",
          },
        ],
      });
    }
  }
}
