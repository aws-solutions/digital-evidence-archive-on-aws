/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { DeaBackendConstruct } from '@aws/dea-backend';
import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DeaMainStack extends cdk.Stack {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // example bucket
    const deaBackendConstruct = new DeaBackendConstruct(this, 'DeaBackendConstruct', {});
    new CfnOutput(this, 'Backend Construct', { value: deaBackendConstruct.toString() });
  }
}
