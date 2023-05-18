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
import { DeaAuditTrail } from '../../constructs/dea-audit-trail';
import { DeaAuth } from '../../constructs/dea-auth';
import { DeaBackendConstruct } from '../../constructs/dea-backend-stack';
import { DeaEventHandlers } from '../../constructs/dea-event-handlers';
import { DeaOperationalDashboard } from '../../constructs/dea-ops-dashboard';
import { DeaParameters } from '../../constructs/dea-parameters';
import { DeaRestApiConstruct } from '../../constructs/dea-rest-api';
import { addSnapshotSerializers } from './dea-snapshot-serializers';
import { validateBackendConstruct } from './validate-backend-construct';

describe('DeaBackend constructs', () => {
  const expectedLambdaCount = 39;
  const expectedMethodCount = 77;

  beforeAll(() => {
    process.env.STAGE = 'RUN1';
    process.env.CONFIGNAME = 'chewbacca';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);

    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      kmsKey: key,
      region: stack.region,
      accountId: stack.account,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
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
    template.resourceCountIs('AWS::Lambda::Function', expectedLambdaCount);
    template.resourceCountIs('AWS::ApiGateway::Method', expectedMethodCount);

    //Auth construct
    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    const authStack = new DeaAuth(stack, 'DeaAuth', {
      region: stack.region,
      restApi: restApi.deaRestApi,
      apiEndpointArns: apiEndpointArns,
    });

    new DeaParameters(stack, 'DeaParameters', {
      deaAuthInfo: authStack.deaAuthInfo,
      kmsKey: key,
    });

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

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      kmsKey: key,
      region: stack.region,
      accountId: stack.account,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
    });

    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    const authStack = new DeaAuth(stack, 'DeaAuth', {
      region: stack.region,
      restApi: restApi.deaRestApi,
      apiEndpointArns: apiEndpointArns,
    });

    new DeaParameters(stack, 'DeaParameters', {
      deaAuthInfo: authStack.deaAuthInfo,
      kmsKey: key,
    });

    // throws due to unassigned parameter
    expect(() => {
      Template.fromStack(stack);
    }).toThrow('ID components may not include unresolved tokens');
  });

  it('synthesizes without Delete Case Handler when `deletionAllowed` Flag is NOT set', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);

    convictConfig.set('deletionAllowed', false);

    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      kmsKey: key,
      region: stack.region,
      accountId: stack.account,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
    });

    //Auth construct
    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    const authStack = new DeaAuth(stack, 'DeaAuth', {
      region: stack.region,
      restApi: restApi.deaRestApi,
      apiEndpointArns: apiEndpointArns,
    });

    new DeaParameters(stack, 'DeaParameters', {
      deaAuthInfo: authStack.deaAuthInfo,
      kmsKey: key,
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
    const expectedLambdaCountWithoutDeleteCaseHandler = expectedLambdaCount - 1;
    const expectedMethodCountWithoutDeleteCaseHandler = expectedMethodCount - 1;
    template.resourceCountIs('AWS::Lambda::Function', expectedLambdaCountWithoutDeleteCaseHandler);
    template.resourceCountIs('AWS::ApiGateway::Method', expectedMethodCountWithoutDeleteCaseHandler);
  });
});
