/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { convictConfig } from '../../config';
import { DeaAuditTrail } from '../../constructs/dea-audit-trail';
import { DeaBackendConstruct } from '../../constructs/dea-backend-stack';
import { DeaOperationalDashboard } from '../../constructs/dea-ops-dashboard';

const PROTECTED_DEA_RESOURCES: string[] = [];

describe('dea audit trail', () => {
  it('synthesizes with additional bucket policy restrictions in production', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);

    convictConfig.set('testStack', false);

    const app = new App();
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

    new DeaAuditTrail(stack, 'DeaAudit', PROTECTED_DEA_RESOURCES, {
      kmsKey: key,
      deaDatasetsBucket: backend.datasetsBucket,
      deaTableArn: backend.deaTable.tableArn,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::BucketPolicy', 3);
  });
});
