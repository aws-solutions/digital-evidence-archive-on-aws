/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { convictConfig } from '../../config';
import { AuditCloudwatchToAthenaInfra } from '../../constructs/create-cloudwatch-to-athena-infra';

describe('audit logs to s3 infrastructure', () => {
  it('synthesizes with expected infra', () => {
    convictConfig.set('testStack', true);
    const app = new App();
    const stack = new Stack(app, 'audit-to-s3-test-stack');

    const key = new Key(stack, 'testKey', {
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const auditLogGroup = new LogGroup(stack, 'audit-log-group');
    const trailLogGroup = new LogGroup(stack, 'trail-log-group');

    const _auditToS3Construct = new AuditCloudwatchToAthenaInfra(stack, 'audit-to-s3-construct', {
      kmsKey: key,
      auditLogGroup,
      trailLogGroup,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('AWS::Athena::WorkGroup', 1);
    template.resourceCountIs('AWS::IAM::Role', 7);
    template.resourceCountIs('AWS::Lambda::Function', 4);
    template.resourceCountIs('AWS::KinesisFirehose::DeliveryStream', 1);
    template.resourceCountIs('AWS::Glue::Table', 1);
    template.resourceCountIs('AWS::Glue::Database', 1);
  });
});
