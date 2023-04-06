/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import {
  createCfnOutput,
  DeaAuditTrail,
  DeaAuthConstruct,
  DeaBackendConstruct,
  deaConfig,
  DeaRestApiConstruct,
  DeaEventHandlers,
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
import { addLambdaSuppressions } from './nag-suppressions';

export class DeaMainStack extends cdk.Stack {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create KMS key to pass into backend and UI
    const kmsKey = this._createEncryptionKey();

    const uiAccessLogPrefix = 'dea-ui-access-log';
    // DEA Backend Construct
    const backendConstruct = new DeaBackendConstruct(this, 'DeaBackendStack', {
      kmsKey: kmsKey,
      accessLogsPrefixes: [uiAccessLogPrefix],
    });

    const region = this.region;
    const accountId = this.account;

    const auditTrail = new DeaAuditTrail(this, 'DeaAudit', {
      kmsKey,
      deaDatasetsBucket: backendConstruct.datasetsBucket,
    });

    const deaEventHandlers = new DeaEventHandlers(this, 'DeaEventHandlers', {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaDatasetsBucketArn: backendConstruct.datasetsBucket.bucketArn,
      kmsKey,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
      },
    });

    const deaApi = new DeaRestApiConstruct(this, 'DeaApiGateway', {
      deaTableArn: backendConstruct.deaTable.tableArn,
      deaTableName: backendConstruct.deaTable.tableName,
      deaDatasetsBucketArn: backendConstruct.datasetsBucket.bucketArn,
      deaDatasetsBucketName: backendConstruct.datasetsBucket.bucketName,
      deaAuditLogArn: auditTrail.auditLogGroup.logGroupArn,
      s3BatchDeleteCaseFileRoleArn: deaEventHandlers.s3BatchDeleteCaseFileRole.roleArn,
      kmsKey,
      region,
      accountId,
      lambdaEnv: {
        AUDIT_LOG_GROUP_NAME: auditTrail.auditLogGroup.logGroupName,
        TABLE_NAME: backendConstruct.deaTable.tableName,
        DATASETS_BUCKET_NAME: backendConstruct.datasetsBucket.bucketName,
        DELETE_CASE_FILE_LAMBDA_ARN: deaEventHandlers.s3BatchDeleteCaseFileLambda.functionArn,
        DELETE_CASE_FILE_ROLE: deaEventHandlers.s3BatchDeleteCaseFileRole.roleArn,
      },
    });

    new DeaAuthConstruct(this, 'DeaAuth', {
      restApi: deaApi.deaRestApi,
      apiEndpointArns: deaApi.apiEndpointArns,
    });

    kmsKey.addToResourcePolicy(
      new PolicyStatement({
        actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey'],
        principals: [new ServicePrincipal(`lambda.${this.region}.amazonaws.com`)],
        resources: [deaApi.lambdaBaseRole.roleArn],
        sid: 'main-key-share-statement',
      })
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
    this._uiStackConstructNagSuppress();

    // These are resources that will be configured in a future story. Please remove these suppressions or modify them to the specific resources as needed
    // when we tackle the particular story. Details in function below
    this._apiGwAuthNagSuppresions();
  }

  private _uiStackConstructNagSuppress(): void {
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

  private _createEncryptionKey(): Key {
    const mainKeyPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['kms:*'],
          principals: [new AccountPrincipal(this.account)],
          resources: ['*'],
          sid: 'main-key-share-statement',
        }),
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
          // resources: [deaApi.accessLogGroup.logGroupArn],
          resources: ['*'],
          sid: 'main-key-share-statement',
        }),
      ],
    });

    const key = new Key(this, 'primaryCustomerKey', {
      enableKeyRotation: true,
      policy: mainKeyPolicy,
      removalPolicy: deaConfig.retainPolicy(),
      pendingWindow: Duration.days(7),
    });

    createCfnOutput(this, 'mainAccountKmsKey', {
      value: key.keyArn,
    });
    return key;
  }

  private _apiGwAuthNagSuppresions(): void {
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
