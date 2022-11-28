/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { DeaBackendConstruct } from '@aws/dea-backend';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class DeaMainStack extends cdk.Stack {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DEA Backend Construct
    new DeaBackendConstruct(this, 'DeaBackendConstruct', {});

    // DEA UI Construct
    new DeaUiConstruct(this, 'DeaUiConstruct', {});

    // Stack node resource handling
    // Suppress CFN issues with dea-main stack as the primary node here since we cannot access
    // resource node directly in the ui or backend construct
    this._uiStackConstructNagSuppress();
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
        ],
      });
    }
  }
}
