/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import {
  DeaAppRegisterConstruct,
  DeaAuditTrail,
  DeaAuth,
  DeaAuthStack,
  DeaBackendConstruct,
  DeaEventHandlers,
  DeaParameters,
  DeaParametersStack,
  DeaRestApiConstruct,
  createCfnOutput,
  deaConfig,
  DeaOperationalDashboard,
} from '@aws/dea-backend';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { CfnResource, Duration } from 'aws-cdk-lib';
import { CfnMethod } from 'aws-cdk-lib/aws-apigateway';
import {
  AccountPrincipal,
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { restrictResourcePolicies } from './apply-bucket-policies';
import { addLambdaSuppressions, addResourcePolicySuppressions } from './nag-suppressions';

// DEA AppRegistry Constants
export const SOLUTION_VERSION = '1.0.0';

export class DeaMainStack extends cdk.Stack {
  private readonly appRegistry: DeaAppRegisterConstruct;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dashboard = new DeaOperationalDashboard(this, 'DeaApiOpsDashboard');

    // DEA App Register Construct
    this.appRegistry = new DeaAppRegisterConstruct(this, this.stackId, {
      solutionId: 'SO0224',
      solutionName: 'Digital Evidence Archive',
      solutionVersion: SOLUTION_VERSION,
      appRegistryApplicationName: 'digital-evidence-archive',
      applicationType: 'AWS-Solutions',
    });
    createCfnOutput(this, 'AppRegistryArn', {
      description: 'ARN of the application registry',
      value: this.appRegistry.registryApplication.applicationArn,
    });

    const protectedDeaResourceArns: string[] = [];

    // Create KMS key to pass into backend and UI
    const kmsKey = this.createEncryptionKey();

    const uiAccessLogPrefix = 'dea-ui-access-log';
    // DEA Backend Construct
    const backendConstruct = new DeaBackendConstruct(this, 'DeaBackendStack', protectedDeaResourceArns, {
      kmsKey: kmsKey,
      accessLogsPrefixes: [uiAccessLogPrefix],
      opsDashboard: dashboard,
    });

    const region = deaConfig.region();
    const accountId = this.account;

    const auditTrail = new DeaAuditTrail(this, 'DeaAudit', protectedDeaResourceArns, {
      kmsKey,
      deaDatasetsBucket: backendConstruct.datasetsBucket,
      deaTableArn: backendConstruct.deaTable.tableArn,
    });

    const deaEventHandlers = new DeaEventHandlers(this, 'DeaEventHandlers', {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaDatasetsBucketArn: backendConstruct.datasetsBucket.bucketArn,
      kmsKey,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
        AWS_USE_FIPS_ENDPOINT: 'true',
      },
      opsDashboard: dashboard,
    });

    const deaApi = new DeaRestApiConstruct(this, 'DeaApiGateway', protectedDeaResourceArns, {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaTableName: backendConstruct.deaTable.tableName,
      deaDatasetsBucket: backendConstruct.datasetsBucket,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      kmsKey,
      region,
      accountId,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
        DELETE_CASE_FILE_LAMBDA_ARN: deaEventHandlers.s3BatchDeleteCaseFileLambda.functionArn,
        DELETE_CASE_FILE_ROLE: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
        AWS_USE_FIPS_ENDPOINT: 'true',
      },
      opsDashboard: dashboard,
    });

    // For OneClick we need to have one Cfn template, so we will
    // deploy DeaAuth and DeaParameters as constructs
    // However for us-gov-east-1, we need to deploy DeaAuth in
    // us-gov-west-1 since Cognito is not available, so we have to
    // deploy DeaAuth as a stack, and DeaParameters as a stack as
    // well to break the cyclic dependency between main stack and deaauth stack
    if (region === 'us-gov-east-1') {
      // Build the Cognito Stack (UserPool and IdentityPool)
      // Along with the IAM Roles
      const authConstruct = new DeaAuthStack(
        scope,
        'DeaAuth',
        {
          // Cognito is not available in us-gov-east-1, so we have to deploy
          // Cognito in us-gov-west-1
          region: 'us-gov-west-1',
          restApi: deaApi.deaRestApi,
          apiEndpointArns: deaApi.apiEndpointArns,
        },
        props
      );

      // Store relevant parameters for the functioning of DEA
      // in SSM Param Store and Secrets Manager
      new DeaParametersStack(
        scope,
        'DeaParameters',
        protectedDeaResourceArns,
        {
          deaAuthInfo: authConstruct.deaAuthInfo,
          kmsKey,
        },
        props
      );
    } else {
      // Build the Cognito Stack (UserPool and IdentityPool)
      // Along with the IAM Roles
      const authConstruct = new DeaAuth(this, 'DeaAuth', {
        region: region,
        restApi: deaApi.deaRestApi,
        apiEndpointArns: deaApi.apiEndpointArns,
      });

      // Store relevant parameters for the functioning of DEA
      // in SSM Param Store and Secrets Manager
      new DeaParameters(this, 'DeaParameters', protectedDeaResourceArns, {
        deaAuthInfo: authConstruct.deaAuthInfo,
        kmsKey,
      });
    }

    restrictResourcePolicies(
      {
        kmsKey,
        accessLogsBucket: backendConstruct.accessLogsBucket,
        datasetsBucket: backendConstruct.datasetsBucket,
      },
      deaApi.lambdaBaseRole,
      deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole,
      deaEventHandlers.s3BatchDeleteCaseFileLambdaRole,
      deaApi.customResourceRole
    );

    const permissionBoundaryOnDeaResources =
      this.createPermissionsBoundaryOnDeaResources(protectedDeaResourceArns);

    createCfnOutput(this, 'PermissionsBoundary', {
      value: `${permissionBoundaryOnDeaResources.managedPolicyArn}`,
    });

    // DEA UI Construct
    new DeaUiConstruct(this, 'DeaUiConstruct', {
      kmsKey: kmsKey,
      restApi: deaApi.deaRestApi,
      accessLogsBucket: backendConstruct.accessLogsBucket,
      accessLogPrefix: uiAccessLogPrefix,
    });

    // Stack node resource handling
    // ======================================
    // Suppress CFN issues with dea-main stack as the primary node here since we cannot access
    // resource node directly in the ui or backend construct
    this.uiStackConstructNagSuppress();

    // These are resources that will be configured in a future story. Please remove these suppressions or modify them to the specific resources as needed
    // when we tackle the particular story. Details in function below
    this.apiGwAuthNagSuppresions();

    this.policyNagSuppresions();
  }

  private uiStackConstructNagSuppress(): void {
    const lambdaSuppresionList = [];

    lambdaSuppresionList.push(
      this.node.findChild('Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C').node.defaultChild
    );

    // custom resource role
    lambdaSuppresionList.push(this.node.findChild('AWS679f53fac002430cb0da5b7982bd2287').node.defaultChild);

    // This will not exist in non-test deploys
    const lambdaChild = this.node.tryFindChild('Custom::S3AutoDeleteObjectsCustomResourceProvider');
    if (lambdaChild) {
      lambdaSuppresionList.push(lambdaChild.node.findChild('Handler'));
    }

    lambdaSuppresionList.forEach((lambdaToSuppress) => {
      if (lambdaToSuppress instanceof CfnResource) {
        addLambdaSuppressions(lambdaToSuppress);
      }
    });
  }

  private createEncryptionKey(): Key {
    const mainKeyPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'kms:Encrypt*',
            'kms:Decrypt*',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:Describe*',
          ],
          principals: [new ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
          resources: ['*'],
          sid: 'main-key-share-statement',
        }),
        // prevent MalformedPolicyDocumentException - kms management can be granted
        new PolicyStatement({
          sid: 'Allow management',
          effect: Effect.ALLOW,
          principals: [new AccountPrincipal(this.account)],
          actions: deaConfig.kmsAccountActions(),
          resources: ['*'],
        }),
      ],
    });

    const key = new Key(this, 'primaryCustomerKey', {
      enableKeyRotation: true,
      policy: mainKeyPolicy,
      removalPolicy: deaConfig.retainPolicy(),
      pendingWindow: Duration.days(7),
    });

    key.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt*'],
        principals: [new AccountPrincipal(this.account)],
        conditions: {
          'ForAnyValue:StringEquals': {
            'aws:CalledVia': ['dynamodb.amazonaws.com'],
          },
        },
        resources: ['*'],
        sid: 'cfn-key-share-statement',
      })
    );

    createCfnOutput(this, 'mainAccountKmsKey', {
      value: key.keyArn,
    });
    return key;
  }

  // Creates a deny all access to DEA resources that customers
  // can attach to existing user IAM roles for the accounts
  // to block sdk/cli/console access to DEA resources outside DEA
  // Details will be added to the Implementation Guide
  private createPermissionsBoundaryOnDeaResources(deaResourceArns: string[]) {
    const statements: PolicyStatement[] = [
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['*'],
        resources: deaResourceArns,
      }),
    ];
    return new ManagedPolicy(this, 'deaResourcesPermissionsBoundary', {
      statements,
    });
  }

  private policyNagSuppresions(): void {
    const cfnResources = [];

    cfnResources.push(
      this.node
        .findChild('DeaEventHandlers')
        .node.findChild('s3-batch-delete-case-file-handler-role')
        .node.findChild('DefaultPolicy').node.defaultChild
    );

    cfnResources.push(
      this.node
        .findChild('DeaEventHandlers')
        .node.findChild('s3-batch-status-change-handler-role')
        .node.findChild('DefaultPolicy').node.defaultChild
    );

    cfnResources.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-base-lambda-role')
        .node.findChild('DefaultPolicy').node.defaultChild
    );

    cfnResources.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('UpdateBucketCORS')
        .node.findChild('CustomResourcePolicy').node.defaultChild
    );

    cfnResources.forEach((cfnResource) => {
      if (cfnResource instanceof CfnResource) {
        return addResourcePolicySuppressions(cfnResource);
      }
    });
  }

  private apiGwAuthNagSuppresions(): void {
    // Nag suppress on all authorizationType related warnings until our Auth implementation is complete
    const apiGwMethodArray = [];

    // API GW - UI Suppressions
    const uiPages = ['login', 'case-detail', 'create-cases', 'upload-files', 'auth-test'];

    //Home page
    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('ui')
        .node.findChild('GET').node.defaultChild
    );

    // Other pages
    uiPages.forEach((page) => {
      apiGwMethodArray.push(
        this.node
          .findChild('DeaApiGateway')
          .node.findChild('dea-api')
          .node.findChild('Default')
          .node.findChild('ui')
          .node.findChild(page)
          .node.findChild('GET').node.defaultChild
      );

      // UI API GW Proxy
      apiGwMethodArray.push(
        this.node
          .findChild('DeaApiGateway')
          .node.findChild('dea-api')
          .node.findChild('Default')
          .node.findChild('ui')
          .node.findChild('{proxy+}')
          .node.findChild('GET').node.defaultChild
      );
    });

    // Auth endpoints
    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('{authCode}')
        .node.findChild('token')
        .node.findChild('POST').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('refreshToken')
        .node.findChild('POST').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('revokeToken')
        .node.findChild('POST').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('loginUrl')
        .node.findChild('GET').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('logoutUrl')
        .node.findChild('GET').node.defaultChild
    );

    apiGwMethodArray.forEach((apiGwMethod) => {
      if (apiGwMethod instanceof CfnMethod) {
        apiGwMethod.addMetadata('cfn_nag', {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          rules_to_suppress: [
            {
              id: 'W59',
              reason: 'Auth not implemented yet, will revisit',
            },
          ],
        });
      }
    });
  }
}
