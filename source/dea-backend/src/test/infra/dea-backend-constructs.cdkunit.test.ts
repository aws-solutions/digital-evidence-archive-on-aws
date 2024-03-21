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
import { ObjectChecksumStack } from '../../constructs/object-checksum-stack';
import { deaApiRouteConfig } from '../../resources/dea-route-config';
import { addSnapshotSerializers } from './dea-snapshot-serializers';
import { validateBackendConstruct } from './validate-backend-construct';

const PROTECTED_DEA_RESOURCES: string[] = [];
const context = {
  'aws:cdk:bundling-stacks': [],
};

describe('DeaBackend constructs', () => {
  const expectedLambdaCount = 58;
  const expectedMethodCount = 92;

  beforeAll(() => {
    process.env.STAGE = 'RUN1';
    process.env.CONFIGNAME = 'devsample';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);

    const app = new cdk.App({
      context,
    });
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
      accessLoggingBucket: backend.accessLogsBucket,
      opsDashboard: dashboard,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      dataSyncLogsBucket: backend.dataSyncLogsBucket,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const checksumStack = new ObjectChecksumStack(stack, 'ObjectChecksumStack', {
      kmsKey: key,
      deaTable: backend.deaTable,
      opsDashboard: dashboard,
      objectBucket: backend.datasetsBucket,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', PROTECTED_DEA_RESOURCES, {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      deaDatasetsBucketDataSyncRoleArn: backend.datasetsDataSyncRole.roleArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaDataSyncReportsBucket: backend.dataSyncLogsBucket,
      deaDataSyncReportsRoleArn: backend.dataSyncLogsBucketRole.roleArn,
      checksumQueue: checksumStack.checksumQueue,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      athenaConfig: {
        athenaOutputBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
        athenaDBName: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        athenaWorkGroupName: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        athenaTableName: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        athenaAuditBucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
      },
      kmsKey: key,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
      flattenRestApi: true,
    });

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    delete template['template']['Mappings'];

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

    const app = new cdk.App({ context });
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
      accessLoggingBucket: backend.accessLogsBucket,
      opsDashboard: dashboard,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      dataSyncLogsBucket: backend.dataSyncLogsBucket,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const checksumStack = new ObjectChecksumStack(stack, 'ObjectChecksumStack', {
      kmsKey: key,
      deaTable: backend.deaTable,
      opsDashboard: dashboard,
      objectBucket: backend.datasetsBucket,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', PROTECTED_DEA_RESOURCES, {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      deaDatasetsBucketDataSyncRoleArn: backend.datasetsDataSyncRole.roleArn,
      deaDataSyncReportsBucket: backend.dataSyncLogsBucket,
      deaDataSyncReportsRoleArn: backend.dataSyncLogsBucketRole.roleArn,
      checksumQueue: checksumStack.checksumQueue,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      kmsKey: key,
      athenaConfig: {
        athenaOutputBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
        athenaDBName: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        athenaWorkGroupName: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        athenaTableName: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        athenaAuditBucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
      },
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

    const template = Template.fromStack(stack);
    template.hasParameter('*', {
      Type: 'String',
    });
  });

  it('synthesizes without Delete Case Handler when `test` Flag is NOT set', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deaprodenv';
    convictConfig.set('cognito.domain', domain);
    convictConfig.set('deaAllowedOrigins', '');
    convictConfig.set('testStack', false);

    const app = new cdk.App({ context });
    const stack = new Stack(app, 'prod-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
      accessLoggingBucket: backend.accessLogsBucket,
      opsDashboard: dashboard,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      dataSyncLogsBucket: backend.dataSyncLogsBucket,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const checksumStack = new ObjectChecksumStack(stack, 'ObjectChecksumStack', {
      kmsKey: key,
      deaTable: backend.deaTable,
      opsDashboard: dashboard,
      objectBucket: backend.datasetsBucket,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', PROTECTED_DEA_RESOURCES, {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      deaDatasetsBucketDataSyncRoleArn: backend.datasetsDataSyncRole.roleArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaDataSyncReportsBucket: backend.dataSyncLogsBucket,
      deaDataSyncReportsRoleArn: backend.dataSyncLogsBucketRole.roleArn,
      checksumQueue: checksumStack.checksumQueue,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      kmsKey: key,
      athenaConfig: {
        athenaOutputBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
        athenaDBName: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        athenaWorkGroupName: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        athenaTableName: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        athenaAuditBucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
      },
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
      flattenRestApi: true,
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
    // prod stack also doesn't have test auth method/lambda
    const awsCDKCfnUtilsProviderCount = 1;
    const testAuthHandlerCount = 1;
    const deleteHandlerCount = 1;
    const expectedLambdaCountWithoutDeleteCaseHandler =
      expectedLambdaCount - testAuthHandlerCount - deleteHandlerCount + awsCDKCfnUtilsProviderCount;

    const expectedMethodCountWithoutDeleteCaseHandler = deaApiRouteConfig.routes.length - 1;
    template.resourceCountIs('AWS::Lambda::Function', expectedLambdaCountWithoutDeleteCaseHandler);
    template.resourceCountIs('AWS::ApiGateway::Method', expectedMethodCountWithoutDeleteCaseHandler);
  });

  it('synthesizes with idp info', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaPath: any = 'some.bogus.site';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaPathType: any = 'URL';
    convictConfig.set('cognito.domain', domain);
    convictConfig.set('idpInfo.metadataPath', metaPath);
    convictConfig.set('idpInfo.metadataPathType', metaPathType);

    const app = new cdk.App({ context });
    const stack = new Stack(app, 'test-stack');

    const key = new Key(stack, 'testKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const dashboard = new DeaOperationalDashboard(stack, 'DeaApiOpsDashboard');

    // Create the DeaBackendConstruct
    const backend = new DeaBackendConstruct(stack, 'DeaBackendConstruct', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      accessLogsPrefixes: ['dea-ui-access-log'],
      opsDashboard: dashboard,
    });
    const auditTrail = new DeaAuditTrail(stack, 'DeaAudit', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
      accessLoggingBucket: backend.accessLogsBucket,
      opsDashboard: dashboard,
    });
    const deaEventHandlers = new DeaEventHandlers(stack, 'DeaEventHandlers', {
      deaDatasetsBucketArn: backend.datasetsBucket.bucketArn,
      dataSyncLogsBucket: backend.dataSyncLogsBucket,
      deaTableArn: backend.deaTable.tableArn,
      lambdaEnv: {},
      kmsKey: key,
      opsDashboard: dashboard,
    });
    const checksumStack = new ObjectChecksumStack(stack, 'ObjectChecksumStack', {
      kmsKey: key,
      deaTable: backend.deaTable,
      opsDashboard: dashboard,
      objectBucket: backend.datasetsBucket,
    });
    const restApi = new DeaRestApiConstruct(stack, 'DeaRestApiConstruct', PROTECTED_DEA_RESOURCES, {
      deaTableArn: backend.deaTable.tableArn,
      deaTableName: backend.deaTable.tableName,
      deaDatasetsBucket: backend.datasetsBucket,
      deaDatasetsBucketDataSyncRoleArn: backend.datasetsDataSyncRole.roleArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaDataSyncReportsBucket: backend.dataSyncLogsBucket,
      checksumQueue: checksumStack.checksumQueue,
      deaDataSyncReportsRoleArn: backend.dataSyncLogsBucketRole.roleArn,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      kmsKey: key,
      athenaConfig: {
        athenaOutputBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
        athenaDBName: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        athenaWorkGroupName: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        athenaTableName: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        athenaAuditBucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
      },
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backend.deaTable.tableName,
        DATASETS_BUCKET_NAME: backend.datasetsBucket.bucketName,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
      },
      opsDashboard: dashboard,
      flattenRestApi: true,
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
  });
});
