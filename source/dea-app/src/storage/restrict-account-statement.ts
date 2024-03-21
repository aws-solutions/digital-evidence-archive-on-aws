/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Aws } from 'aws-cdk-lib';
import { PolicyStatementProps } from 'aws-cdk-lib/aws-iam';

export const restrictAccountStatement = {
  Sid: 'AllowS3AccessInTrustedAccounts',
  Effect: 'Allow',
  Action: ['s3:PutObject', 's3:GetObject'],
  Resource: '*',
  Condition: {
    StringEquals: {
      's3:ResourceAccount': [Aws.ACCOUNT_ID],
    },
  },
};

export const restrictAccountStatementStatementProps: PolicyStatementProps = {
  actions: restrictAccountStatement.Action,
  conditions: restrictAccountStatement.Condition,
  resources: [restrictAccountStatement.Resource],
};
