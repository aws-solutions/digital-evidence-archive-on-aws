/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CfnResource } from 'aws-cdk-lib';
import { CfnMethod } from 'aws-cdk-lib/aws-apigateway';
import { Node } from 'constructs';

export const addLambdaSuppressions = (cdkLambda: CfnResource): void => {
  cdkLambda.addMetadata('cfn_nag', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    rules_to_suppress: [
      {
        id: 'W58',
        reason:
          'AWSCustomResource Lambda Function has AWSLambdaBasicExecutionRole policy attached which has the required permission to write to Cloudwatch Logs',
      },
      {
        id: 'W92',
        reason: 'Reserved concurrency is currently not required. Revisit in the future',
      },
      {
        id: 'W89',
        reason:
          'The serverless application lens (https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/aws-lambda.html)\
        indicates lambdas should not be deployed in private VPCs unless they require acces to resources also within a VPC',
      },
    ],
  });
};

export const addResourcePolicySuppressions = (cdkPolicy: CfnResource): void => {
  cdkPolicy.addMetadata('cfn_nag', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    rules_to_suppress: [
      {
        id: 'W12',
        reason: 'Star resource is required for the action',
      },
      {
        id: 'W76',
        reason: 'Complexity generated via CDK environment',
      },
    ],
  });
};

export const deaUiStackNagSuppress = (node: Node): void => {
  const lambdaSuppresionList = [];

  // custom resource role
  lambdaSuppresionList.push(node.findChild('AWS679f53fac002430cb0da5b7982bd2287').node.defaultChild);

  // This will not exist in non-test deploys
  const lambdaChild = node.tryFindChild('Custom::S3AutoDeleteObjectsCustomResourceProvider');
  if (lambdaChild) {
    lambdaSuppresionList.push(lambdaChild.node.findChild('Handler'));
  }

  lambdaSuppresionList.forEach((lambdaToSuppress) => {
    if (lambdaToSuppress instanceof CfnResource) {
      addLambdaSuppressions(lambdaToSuppress);
    }
  });
};

export const deaMainLambdaNagSuppresions = (node: Node): void => {
  const lambdaSuppresionList = [];
  lambdaSuppresionList.push(
    node
      .findChild('DeaAudit')
      .node.findChild('DeaAudit')
      .node.findChild('audit-processing-lambda')
      .node.findChild('Resource')
  );
  lambdaSuppresionList.push(
    node.findChild('BucketNotificationsHandler050a0587b7544547bf325f094a3db834').node.findChild('Resource')
  );
  lambdaSuppresionList.push(node.findChild('s3-object-locker').node.findChild('Resource'));

  // This will not exist in non-test deploys
  const lambdaChild = node.tryFindChild('AWSCDKCfnUtilsProviderCustomResourceProvider');
  if (lambdaChild) {
    lambdaSuppresionList.push(lambdaChild.node.findChild('Handler'));
  }

  lambdaSuppresionList.forEach((lambdaToSuppress) => {
    if (lambdaToSuppress instanceof CfnResource) {
      addLambdaSuppressions(lambdaToSuppress);
    }
  });
};

export const deaMainPolicyNagSuppresions = (node: Node): void => {
  const cfnResources = [];

  cfnResources.push(
    node
      .findChild('DeaEventHandlers')
      .node.findChild('s3-batch-delete-case-file-handler-role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaEventHandlers')
      .node.findChild('s3-batch-status-change-handler-role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('dea-base-lambda-role').node.findChild('DefaultPolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('UpdateBucketCORS0').node.findChild('CustomResourcePolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('UpdateBucketCORS1').node.findChild('CustomResourcePolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaBackendStack')
      .node.findChild('DataSyncPermissionsRole')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaBackendStack')
      .node.findChild('deaDataSyncLogsBucketRole')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaAudit')
      .node.findChild('DeaAudit')
      .node.findChild('FireHosetoS3Role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaAudit')
      .node.findChild('DeaAudit')
      .node.findChild('audit-processing-lambda')
      .node.findChild('ServiceRole')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaEventHandlers')
      .node.findChild('s3-batch-delete-case-file-role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaEventHandlers')
      .node.findChild('data-sync-execution-event-role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('dea-auth-lambda-role').node.findChild('DefaultPolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node.findChild('s3-object-locker').node.findChild('ServiceRole').node.findChild('DefaultPolicy').node
      .defaultChild
  );

  cfnResources.push(
    node
      .findChild('BucketNotificationsHandler050a0587b7544547bf325f094a3db834')
      .node.findChild('Role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('dea-initiate-upload-role').node.findChild('DefaultPolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('dea-complete-upload-role').node.findChild('DefaultPolicy')
      .node.defaultChild
  );

  cfnResources.push(
    node.findChild('DeaApiGateway').node.findChild('dea-datasets-role').node.findChild('DefaultPolicy').node
      .defaultChild
  );

  cfnResources.push(
    node
      .findChild('DeaApiGateway')
      .node.findChild('dea-execution-lambda-role')
      .node.findChild('DefaultPolicy').node.defaultChild
  );

  cfnResources.forEach((cfnResource) => {
    if (cfnResource instanceof CfnResource) {
      return addResourcePolicySuppressions(cfnResource);
    }
  });
};

export const deaApiGwAuthNagSuppressions = (node: Node): void => {
  // Nag suppress on all authorizationType related warnings until our Auth implementation is complete
  const apiGwMethodArray = [];

  // API GW - UI Suppressions
  const uiPages = [
    'login',
    'case-detail',
    'create-cases',
    'upload-files',
    'auth-test',
    'data-vaults',
    'data-vault-detail',
    'create-data-vaults',
    'edit-data-vault',
    'data-sync-tasks',
    'data-vault-file-detail',
  ];

  //Home page
  apiGwMethodArray.push(
    node
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
      node
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
      node
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
    node
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
    node
      .findChild('DeaApiGateway')
      .node.findChild('dea-api-stack')
      .node.findChild('dea-api')
      .node.findChild('Default')
      .node.findChild('auth')
      .node.findChild('refreshToken')
      .node.findChild('POST').node.defaultChild
  );

  apiGwMethodArray.push(
    node
      .findChild('DeaApiGateway')
      .node.findChild('dea-api-stack')
      .node.findChild('dea-api')
      .node.findChild('Default')
      .node.findChild('auth')
      .node.findChild('revokeToken')
      .node.findChild('POST').node.defaultChild
  );

  apiGwMethodArray.push(
    node
      .findChild('DeaApiGateway')
      .node.findChild('dea-api-stack')
      .node.findChild('dea-api')
      .node.findChild('Default')
      .node.findChild('auth')
      .node.findChild('loginUrl')
      .node.findChild('GET').node.defaultChild
  );

  apiGwMethodArray.push(
    node
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
            reason: 'Auth not required on auth related APIs or UI',
          },
        ],
      });
    }
  });
};
