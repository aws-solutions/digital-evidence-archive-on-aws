/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import assert from 'assert';
import { deaConfig } from '@aws/dea-backend/lib/config';
import { createCfnOutput } from '@aws/dea-backend/lib/constructs/construct-support';
import { DeaAppRegisterConstruct } from '@aws/dea-backend/lib/constructs/dea-app-registry';
import { DeaAuditTrail } from '@aws/dea-backend/lib/constructs/dea-audit-trail';
import { DeaAuth, DeaAuthStack } from '@aws/dea-backend/lib/constructs/dea-auth';
import { DeaBackendConstruct } from '@aws/dea-backend/lib/constructs/dea-backend-stack';
import { DeaEventHandlers } from '@aws/dea-backend/lib/constructs/dea-event-handlers';
import { DeaOperationalDashboard } from '@aws/dea-backend/lib/constructs/dea-ops-dashboard';
import { DeaParameters, DeaParametersStack } from '@aws/dea-backend/lib/constructs/dea-parameters';
import { DeaRestApiConstruct } from '@aws/dea-backend/lib/constructs/dea-rest-api';
import { addLegalHoldInfrastructure } from '@aws/dea-backend/lib/constructs/legal-hold-infra';
import {
  addLambdaSuppressions,
  addResourcePolicySuppressions,
} from '@aws/dea-backend/lib/helpers/nag-suppressions';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure/lib/dea-ui-stack';
import * as cdk from 'aws-cdk-lib';
import { Aws, CfnResource, Duration } from 'aws-cdk-lib';
import { CfnMethod } from 'aws-cdk-lib/aws-apigateway';
import {
  AccountPrincipal,
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { restrictResourcePolicies } from './apply-bucket-policies';

// DEA AppRegistry Constants
// TODO - would be ideal to reference process.env.npm_package_version here but rush breaks that env
export const SOLUTION_VERSION = '1.0.6';
export const SOLUTION_ID = 'SO0224';

export class DeaMainStack extends cdk.Stack {
  private readonly appRegistry: DeaAppRegisterConstruct;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    const stackProps: cdk.StackProps = {
      suppressTemplateIndentation: true,
      ...props,
      description: `(${SOLUTION_ID}) Digital Evidence Archive v${SOLUTION_VERSION} - This solution helps investigative units manage and store digital evidence on AWS.`,
    };

    super(scope, id, stackProps);

    const nestedConstructs: cdk.NestedStack[] = [];

    let dashboard: DeaOperationalDashboard | undefined = undefined;
    if (!deaConfig.isOneClick()) {
      dashboard = new DeaOperationalDashboard(this, 'DeaApiOpsDashboard');
    }

    // DEA App Register Construct
    this.appRegistry = new DeaAppRegisterConstruct(this, this.stackId, {
      solutionId: SOLUTION_ID,
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

    createCfnOutput(this, 'deaTableName', {
      value: backendConstruct.deaTable.tableName,
    });

    const region = deaConfig.region();
    const stage = deaConfig.stage();

    const auditTrail = new DeaAuditTrail(this, 'DeaAudit', protectedDeaResourceArns, {
      kmsKey,
      deaDatasetsBucket: backendConstruct.datasetsBucket,
      deaTableArn: backendConstruct.deaTable.tableArn,
      accessLoggingBucket: backendConstruct.accessLogsBucket,
      opsDashboard: dashboard,
    });

    const deaEventHandlers = new DeaEventHandlers(this, 'DeaEventHandlers', {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaDatasetsBucketArn: backendConstruct.datasetsBucket.bucketArn,
      dataSyncLogsBucket: backendConstruct.dataSyncLogsBucket,
      kmsKey,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
        AWS_USE_FIPS_ENDPOINT: deaConfig.fipsEndpointsEnabled().toString(),
        DELETION_ALLOWED: deaConfig.deletionAllowed().toString(),
        SOLUTION_ID,
        SOLUTION_VERSION,
      },
      opsDashboard: dashboard,
    });

    const objectLockHandlerRole = addLegalHoldInfrastructure(
      this,
      [
        {
          bucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
          prefix: `${auditTrail.auditCloudwatchToS3Infra.auditPrefix}`,
        },
        { bucket: backendConstruct.datasetsBucket, prefix: '' },
      ],
      dashboard
    );

    const deaApi = new DeaRestApiConstruct(this, 'DeaApiGateway', protectedDeaResourceArns, {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaTableName: backendConstruct.deaTable.tableName,
      deaDatasetsBucket: backendConstruct.datasetsBucket,
      deaDatasetsBucketDataSyncRoleArn: backendConstruct.datasetsDataSyncRole.roleArn,
      deaDataSyncReportsBucket: backendConstruct.dataSyncLogsBucket,
      deaDataSyncReportsRoleArn: backendConstruct.dataSyncLogsBucketRole.roleArn,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      deaTrailLogArn: auditTrail.trailLogGroup.logGroupArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      kmsKey,
      athenaConfig: {
        athenaOutputBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
        athenaDBName: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        athenaWorkGroupName: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        athenaTableName: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        athenaAuditBucket: auditTrail.auditCloudwatchToS3Infra.athenaAuditBucket,
      },
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
        DELETE_CASE_FILE_LAMBDA_ARN: deaEventHandlers.s3BatchDeleteCaseFileLambda.functionArn,
        DELETE_CASE_FILE_ROLE: deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
        TRAIL_LOG_GROUP_NAME: auditTrail.trailLogGroup.logGroupName,
        AWS_USE_FIPS_ENDPOINT: deaConfig.fipsEndpointsEnabled().toString(),
        SOURCE_IP_VALIDATION_ENABLED: deaConfig.sourceIpValidationEnabled().toString(),
        DELETION_ALLOWED: deaConfig.deletionAllowed().toString(),
        UPLOAD_FILES_TIMEOUT_MINUTES: deaConfig.uploadFilesTimeoutMinutes().toString(),
        ATHENA_WORKGROUP: auditTrail.auditCloudwatchToS3Infra.athenaWorkGroupName,
        AUDIT_GLUE_DATABASE: auditTrail.auditCloudwatchToS3Infra.athenaDBName,
        AUDIT_GLUE_TABLE: auditTrail.auditCloudwatchToS3Infra.athenaTableName,
        AUDIT_DOWNLOAD_FILES_TIMEOUT_MINUTES: deaConfig.auditDownloadTimeoutMinutes().toString(),
        SOLUTION_ID,
        SOLUTION_VERSION,
      },
      opsDashboard: dashboard,
      nestedConstructs,
    });
    // For OneClick we need to have one Cfn template, so we will
    // deploy DeaAuth and DeaParameters as constructs
    // However for us-gov-east-1, we need to deploy DeaAuth in
    // us-gov-west-1 since Cognito is not available, so we have to
    // deploy DeaAuth as a stack, and DeaParameters as a stack as
    // well to break the cyclic dependency between main stack and deaauth stack
    if (!deaConfig.isOneClick() && region === 'us-gov-east-1') {
      // Build the Cognito Stack (UserPool and IdentityPool)
      // Along with the IAM Roles
      const authConstruct = new DeaAuthStack(
        scope,
        `${stage}-DeaAuth`,
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
        `${stage}-DeaParameters`,
        {
          deaAuthInfo: authConstruct.deaAuthInfo,
          kmsKey,
        },
        props
      );
    } else {
      // Build the Cognito Stack (UserPool and IdentityPool)
      // Along with the IAM Roles
      const authConstruct = new DeaAuth(this, `DeaAuth`, {
        region: region,
        restApi: deaApi.deaRestApi,
        apiEndpointArns: deaApi.apiEndpointArns,
      });

      // Store relevant parameters for the functioning of DEA
      // in SSM Param Store and Secrets Manager
      const deaParams = new DeaParameters(this, `DeaParameters`, {
        deaAuthInfo: authConstruct.deaAuthInfo,
        kmsKey,
      });

      nestedConstructs.push(deaParams);
    }

    // Add SSM/SecretManager paths to protected DeaResourceArns
    protectedDeaResourceArns.push(
      `arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/dev/1/${stage}*`
    );
    protectedDeaResourceArns.push(
      `arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:/dev/1/${stage}/*`
    );

    const applicationAccessRoleArns = [
      deaApi.lambdaBaseRole.roleArn,
      ...Array.from(deaApi.roleMap).map(([, role]) => role.roleArn),
      deaEventHandlers.s3BatchDeleteCaseFileBatchJobRole.roleArn,
      deaEventHandlers.s3BatchDeleteCaseFileLambdaRole.roleArn,
      deaApi.datasetsRole.roleArn,
      backendConstruct.datasetsDataSyncRole.roleArn,
      deaEventHandlers.dataSyncExecutionEventRole.roleArn,
      objectLockHandlerRole.roleArn,
    ];
    restrictResourcePolicies(
      {
        kmsKey,
        accessLogsBucket: backendConstruct.accessLogsBucket,
        datasetsBucket: backendConstruct.datasetsBucket,
        auditQueryBucket: auditTrail.auditCloudwatchToS3Infra.athenaOutputBucket,
      },
      deaApi.customResourceRole,
      applicationAccessRoleArns,
      deaConfig.adminRoleArn(),
      deaApi.endUserUploadRole.roleArn
    );

    const permissionBoundaryOnDeaResources =
      this.createPermissionsBoundaryOnDeaResources(protectedDeaResourceArns);

    createCfnOutput(this, 'PermissionsBoundary', {
      value: `${permissionBoundaryOnDeaResources.managedPolicyArn}`,
    });

    // DEA UI Construct
    const uiConstruct = new DeaUiConstruct(this, 'DeaUiNestedStack', {
      kmsKey: kmsKey,
      restApi: deaApi.deaRestApi,
      accessLogsBucket: backendConstruct.accessLogsBucket,
      accessLogPrefix: uiAccessLogPrefix,
    });
    nestedConstructs.push(uiConstruct);

    createCfnOutput(this, 'artifactBucketName', {
      value: uiConstruct.bucket.bucketName,
    });

    if (deaConfig.isOneClick()) {
      // Fetch solutions bucket and version
      const DIST_BUCKET = process.env.DIST_OUTPUT_BUCKET ?? assert(false);
      const DIST_VERSION = process.env.DIST_VERSION || '%%VERSION%%';
      const solutionsBucketName = `${DIST_BUCKET}-reference`;
      for (const nestedConstruct of nestedConstructs) {
        const nestedStackResource = nestedConstruct.nestedStackResource;
        if (nestedStackResource instanceof CfnResource) {
          const templateUrl = `https://${solutionsBucketName}.s3.amazonaws.com/digital-evidence-archive/${DIST_VERSION}/${nestedConstruct.artifactId}.nested.template`;
          nestedStackResource.addPropertyOverride('TemplateURL', templateUrl);
        }
      }
    }

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
          principals: [new ServicePrincipal(`logs.amazonaws.com`)],
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

    const adminRoleArn = deaConfig.adminRoleArn();
    if (adminRoleArn) {
      mainKeyPolicy.addStatements(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:GenerateDataKey*'],
          principals: [new ArnPrincipal(adminRoleArn)],
          resources: ['*'],
          sid: 'grant admin key access',
        })
      );
    }

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
        .node.findChild('UpdateBucketCORS0')
        .node.findChild('CustomResourcePolicy').node.defaultChild
    );

    cfnResources.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('UpdateBucketCORS1')
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
        .node.findChild('dea-api-stack')
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
          .node.findChild('dea-api-stack')
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
          .node.findChild('dea-api-stack')
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
        .node.findChild('dea-api-stack')
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
        .node.findChild('dea-api-stack')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('refreshToken')
        .node.findChild('POST').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api-stack')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('revokeToken')
        .node.findChild('POST').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api-stack')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('auth')
        .node.findChild('loginUrl')
        .node.findChild('GET').node.defaultChild
    );

    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api-stack')
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
