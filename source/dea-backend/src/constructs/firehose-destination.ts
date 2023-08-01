/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Aws } from 'aws-cdk-lib';
import { CfnPolicy, CfnRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  ILogGroup,
  ILogSubscriptionDestination,
  LogSubscriptionDestinationConfig,
} from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Use a Kinesis stream as the destination for a log subscription
 */
export class FirehoseDestination implements ILogSubscriptionDestination {
  /**
   * @param fireHoseArn The Arn of the Kinesis Firehose to use as destination
   *
   */
  constructor(private readonly fireHoseArn: string) {}

  public bind(scope: Construct, _sourceLogGroup: ILogGroup): LogSubscriptionDestinationConfig {
    // Create a role to be assumed by CWL that can write to this stream and pass itself.
    const id = 'CloudWatchLogsCanPutRecords';
    const role = new Role(scope, id, {
      assumedBy: new ServicePrincipal('logs.amazonaws.com', {
        conditions: {
          // prevent confused deputy
          StringLike: { 'aws:SourceArn': `arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:*` },
        },
      }),
    });
    role.grantPassRole(role);

    role.addToPolicy(
      new PolicyStatement({
        actions: ['firehose:PutRecord'],
        resources: [this.fireHoseArn],
      })
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const policy = role.node.tryFindChild('DefaultPolicy') as CfnPolicy | undefined;
    if (policy) {
      // Remove circular dependency
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cfnRole = role.node.defaultChild as CfnRole | undefined;
      cfnRole?.addOverride('DependsOn', undefined);

      // Ensure policy is created before subscription filter
      scope.node.addDependency(policy);
    }

    return { arn: this.fireHoseArn, role };
  }
}
