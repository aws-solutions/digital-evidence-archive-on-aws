/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import 'source-map-support/register';
import { validateDeaUiConstruct } from '../..';
import { DeaUiConstruct } from '../../dea-ui-stack';

describe('DeaMainStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'test';
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
      });

    const restApi = new RestApi(stack, 'testApi', { description: 'Backend API' });

    new DeaUiConstruct(stack, 'DeaUiConstruct', { kmsKey: key, accessLogsBucket: accessLogsBucket, restApi, accessLogPrefix: 'dea-ui-access-log' });

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
    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('AWS::ApiGateway::Method', 2);
    template.resourceCountIs('AWS::Lambda::Function', 2);

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes('zip'),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal = (val as string).replace(/([A-Fa-f0-9]{64})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect(template).toMatchSnapshot();
  });
});
