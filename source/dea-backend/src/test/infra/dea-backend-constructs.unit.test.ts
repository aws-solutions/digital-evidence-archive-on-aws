/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import 'source-map-support/register';
import { convictConfig } from '../../config';
import { DeaAuthConstruct } from '../../constructs/dea-auth';
import { DeaBackendConstruct } from '../../constructs/dea-backend-stack';
import { DeaRestApiConstruct } from '../../constructs/dea-rest-api';
import { addSnapshotSerializers } from './dea-snapshot-serializers';
import { validateBackendConstruct } from './validate-backend-construct';

describe('DeaBackend constructs', () => {
  beforeAll(() => {
    process.env.STAGE = 'chewbacca';
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
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
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
    template.resourceCountIs('AWS::Lambda::Function', 15);
    template.resourceCountIs('AWS::ApiGateway::Method', 30);

    //Auth construct
    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    new DeaAuthConstruct(stack, 'DeaAuth', { restApi: restApi.deaRestApi, apiEndpointArns: apiEndpointArns });

    addSnapshotSerializers();

    expect(template).toMatchSnapshot();
  });

  it('works without a domain config', () => {
    convictConfig.set('cognito.domain', undefined);

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
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      deaDatasetsBucketName: backend.datasetsBucket.bucketName,
      kmsKey: key,
      region: stack.region,
      accountId: stack.account,
    });

    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    new DeaAuthConstruct(stack, 'DeaAuth', { restApi: restApi.deaRestApi, apiEndpointArns: apiEndpointArns });

    // throws due to unassigned parameter
    expect(() => {
      Template.fromStack(stack);
    }).toThrow('ID components may not include unresolved tokens');
  });
});
