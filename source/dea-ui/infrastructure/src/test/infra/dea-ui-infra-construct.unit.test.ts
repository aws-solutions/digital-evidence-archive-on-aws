/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { addSnapshotSerializers } from '@aws/dea-backend';
import { convictConfig } from '@aws/dea-backend/lib/config';
import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import 'source-map-support/register';
import { validateDeaUiConstruct } from '../..';
import { DeaUiConstruct } from '../../dea-ui-stack';

describe('DEA UI Infrastructure stack', () => {
  beforeAll(() => {
    process.env.STAGE = 'devsample';
    process.env.DIST_OUTPUT_BUCKET = 'DOC-EXAMPLE-BUCKET';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const accessLogsBucket = new Bucket(stack, 'testS3AccessLogBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const restApi = new RestApi(stack, 'testApi', { description: 'Backend API' });

    new DeaUiConstruct(
      stack,
      'DeaUiConstruct',
      {
        kmsKey: key,
        accessLogsBucket: accessLogsBucket,
        restApi,
        accessLogPrefix: 'dea-ui-access-log',
      },
      [],
      []
    );

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    delete template['template']['Mappings'];

    // assertions relevant to backend and any parent
    validateDeaUiConstruct(template);

    // ui-specific assertions
    template.allResourcesProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    //handlers + authorizer
    const expectedBucketCount = 2;
    const expectedLambdaCount = 2;
    const expectedMethodCount = 7;
    template.resourceCountIs('AWS::S3::Bucket', expectedBucketCount);
    template.resourceCountIs('AWS::ApiGateway::Method', expectedMethodCount);
    template.resourceCountIs('AWS::Lambda::Function', expectedLambdaCount);

    addSnapshotSerializers();

    expect(template).toMatchSnapshot();
  });

  it('synthesizes the with isOneClick flag enabled', () => {
    // set isOneClick to true
    convictConfig.set('isOneClick', true);

    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const accessLogsBucket = new Bucket(stack, 'testS3AccessLogBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const restApi = new RestApi(stack, 'testApi', { description: 'Backend API' });

    new DeaUiConstruct(
      stack,
      'DeaUiConstruct',
      {
        kmsKey: key,
        accessLogsBucket: accessLogsBucket,
        restApi,
        accessLogPrefix: 'dea-ui-access-log',
      },
      [],
      []
    );

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);

    // assertions relevant to backend and any parent
    validateDeaUiConstruct(template);

    // ui-specific assertions
    template.allResourcesProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    //handlers + authorizer
    const expectedBucketCount = 2;
    const expectedLambdaCount = 2;
    const expectedMethodCount = 7;
    template.resourceCountIs('AWS::S3::Bucket', expectedBucketCount);
    template.resourceCountIs('AWS::ApiGateway::Method', expectedMethodCount);
    template.resourceCountIs('AWS::Lambda::Function', expectedLambdaCount);
  });
});
