/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CfnResource } from 'aws-cdk-lib';

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
