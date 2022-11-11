/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { DeaBackendConstruct } from '@aws/dea-backend';
import { DeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DeaMainStack extends cdk.Stack {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DEA Backend Construct
    const deaBackendConstruct = new DeaBackendConstruct(this, 'DeaBackendConstruct', {});
    new CfnOutput(this, 'Backend Construct', { value: deaBackendConstruct.toString() });

    // DEA UI Construct
    const deaUiConstruct = new DeaUiConstruct(this, 'DeaUiConstruct', {});
    new CfnOutput(this, 'UI Construct', { value: deaUiConstruct.toString() });
  }
}
