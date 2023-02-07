/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import 'source-map-support/register';
import { deaConfig } from '../../config';
import { DeaBackendConstruct } from '../../constructs/dea-backend-stack';
import { DeaRestApiConstruct } from '../../constructs/dea-rest-api';
import { validateBackendConstruct } from './validate-backend-construct';

describe('DeaBackend constructs', () => {
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

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
    });
    new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      deaDatasetsBucketName: backend.datasetsBucket.bucketName,
      kmsKey: key,
      region: stack.region,
      accountId: stack.account,
    });

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);

    // assertions relevant to backend and any parent
    validateBackendConstruct(template);

    // backend-specific assertions
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'AWS_IAM',
    });

    //handlers
    template.resourceCountIs('AWS::Lambda::Function', 9);
    template.resourceCountIs('AWS::ApiGateway::Method', 17);

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes('zip'),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal = (val as string).replace(/([A-Fa-f0-9]{64})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes(deaConfig.stage()),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal1 = (val as string).replace(deaConfig.stage(), '[STAGE-REMOVED]');
        const newVal = newVal1.replace(/([A-Fa-f0-9]{8})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect(template).toMatchSnapshot();
  });
});
