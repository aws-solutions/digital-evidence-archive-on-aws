/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { DeaBackendConstruct } from '@aws/dea-backend';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { CfnMethod } from 'aws-cdk-lib/aws-apigateway';
import { AccountPrincipal, PolicyDocument, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class DeaMainStack extends cdk.Stack {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create KMS key to pass into backend and UI
    const kmsKey: Key = this._createEncryptionKey();

    // DEA Backend Construct
    new DeaBackendConstruct(this, 'DeaBackendConstruct', { kmsKey: kmsKey });

    // DEA UI Construct
    new DeaUiConstruct(this, 'DeaUiConstruct', { kmsKey: kmsKey });

    // Stack node resource handling
    // ======================================
    // Suppress CFN issues with dea-main stack as the primary node here since we cannot access
    // resource node directly in the ui or backend construct
    this._uiStackConstructNagSuppress();

    // TODO: Stack Handling
    // These are resources that will be configured in a future story. Please remove these suppressions or modify them to the specific resources as needed
    // when we tackle the particular story. Details in function below
    this._apiGwAuthNagSuppresions();
  }

  private _uiStackConstructNagSuppress(): void {
    // Suppress W58 for custom resource
    const cdkLambda = this.node.findChild('Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C').node
      .defaultChild;
    if (cdkLambda instanceof CfnFunction) {
      cdkLambda.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W58',
            reason:
              'AWSCustomResource Lambda Function has AWSLambdaBasicExecutionRole policy attached which has the required permission to write to Cloudwatch Logs',
          },
          {
            id: 'W59',
            reason:
              'AWSCustomResource Lambda Function does not yet have an AuthorizationType. In development for Custom Lambda Authorizers now.',
          },
          {
            id: 'W89',
            reason: 'VPCs are not used for this use case. Custom resource for serving UI',
          },
          {
            id: 'W92',
            reason:
              'AWSCustomResource Lambda Function used for provisioning UI assets, reserved concurrency is not required',
          },
        ],
      });
    }
  }

  private _apiGwAuthNagSuppresions(): void {
    // Nag suppress on all authorizationType related warnings until our Auth implementation is complete
    const apiGwMethodArray = [];
    // Backend API GW
    apiGwMethodArray.push(
      this.node
        .findChild('DeaBackendStack')
        .node.findChild('API-Gateway API')
        .node.findChild('Default')
        .node.findChild('{proxy+}')
        .node.findChild('ANY').node.defaultChild
    );

    // Backend API Usage Plan
    apiGwMethodArray.push(
      this.node
        .findChild('DeaBackendStack')
        .node.findChild('API-Gateway API')
        .node.findChild('Default')
        .node.findChild('ANY').node.defaultChild
    );

    // Hello API GET Method
    apiGwMethodArray.push(
      this.node
        .findChild('DeaBackendStack')
        .node.findChild('API-Gateway API')
        .node.findChild('Default')
        .node.findChild('hello')
        .node.findChild('GET').node.defaultChild
    );

    // UI API GW
    apiGwMethodArray.push(
      this.node
        .findChild('DeaUiStack')
        .node.findChild('dea-ui-gateway')
        .node.findChild('Default')
        .node.findChild('GET').node.defaultChild
    );

    // UI API GW Proxy
    apiGwMethodArray.push(
      this.node
        .findChild('DeaUiStack')
        .node.findChild('dea-ui-gateway')
        .node.findChild('Default')
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

  private _createEncryptionKey(): Key {
    const mainKeyPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['kms:*'],
          principals: [new AccountPrincipal(this.account)],
          resources: ['*'],
          sid: 'main-key-share-statement',
        }),
        new PolicyStatement({
          actions: ['kms:*'],
          principals: [new ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
          resources: ['*'],
          sid: 'main-key-share-statement',
        }),
      ],
    });

    const key = new Key(this, 'mainAccountKey', {
      enableKeyRotation: true,
      policy: mainKeyPolicy,
    });

    new CfnOutput(this, 'main account kms key', {
      value: key.keyArn,
    });
    return key;
  }
}
