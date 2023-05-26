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
} from '@aws/dea-backend';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { CfnResource, Duration } from 'aws-cdk-lib';
import { CfnMethod } from 'aws-cdk-lib/aws-apigateway';
import {
  AccountPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { restrictResourcePolicies } from './apply-bucket-policies';
import { addLambdaSuppressions } from './nag-suppressions';

// DEA AppRegistry Constants
export const SOLUTION_VERSION = '1.0.0';

export class DeaMainStack extends cdk.Stack {
  private readonly appRegistry: DeaAppRegisterConstruct;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // Create KMS key to pass into backend and UI
    const kmsKey = this.createEncryptionKey();

    const uiAccessLogPrefix = 'dea-ui-access-log';
    // DEA Backend Construct
    const backendConstruct = new DeaBackendConstruct(this, 'DeaBackendStack', {
      kmsKey: kmsKey,
      accessLogsPrefixes: [uiAccessLogPrefix],
    });

    const region = deaConfig.region();
    const accountId = this.account;

    const auditTrail = new DeaAuditTrail(this, 'DeaAudit', {
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
    });

    const deaApi = new DeaRestApiConstruct(this, 'DeaApiGateway', {
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
        SOURCE_IP_VALIDATION_ENABLED: deaConfig.sourceIpValidationEnabled().toString(),
      },
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
      new DeaParameters(this, 'DeaParameters', {
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
      deaApi.customResourceRole,
      deaApi.datasetsRole
    );

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
  }

  private uiStackConstructNagSuppress(): void {
    const cdkLambda = this.node.findChild('Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C').node
      .defaultChild;
    if (cdkLambda instanceof CfnFunction) {
      addLambdaSuppressions(cdkLambda);
    }

    // This will not exist in non-test deploys
    const lambdaChild = this.node.tryFindChild('Custom::S3AutoDeleteObjectsCustomResourceProvider');
    if (lambdaChild) {
      const autoDeleteLambda = lambdaChild.node.findChild('Handler');
      if (autoDeleteLambda instanceof CfnResource) {
        addLambdaSuppressions(autoDeleteLambda);
      }
    }
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

  private apiGwAuthNagSuppresions(): void {
    // Nag suppress on all authorizationType related warnings until our Auth implementation is complete
    const apiGwMethodArray = [];
    // Backend API GW

    // UI API GW
    apiGwMethodArray.push(
      this.node
        .findChild('DeaApiGateway')
        .node.findChild('dea-api')
        .node.findChild('Default')
        .node.findChild('ui')
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
