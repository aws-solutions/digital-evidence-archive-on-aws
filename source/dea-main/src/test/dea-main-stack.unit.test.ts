/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { DeaMainStack } from '../dea-main-stack';

describe('DeaBackendStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'test';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaBackendStack.
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', {});

    // TODO
    // Prepare the stack for assertions.
    const template = Template.fromStack(deaMainStack);

    // Assert it creates the function with the correct properties...
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'Backend API',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: Runtime.NODEJS_16_X.name,
    });

    // Assert it creates the api with the correct properties...
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'distribution api',
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
      AccessControl: BucketAccessControl.PRIVATE,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    expect(template).toMatchSnapshot();
  });
});
