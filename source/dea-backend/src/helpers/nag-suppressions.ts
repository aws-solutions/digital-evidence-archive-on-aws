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
        reason: '',
      },
      {
        id: 'W92',
        reason: '',
      },
      {
        id: 'W89',
        reason: '',
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
        reason: '',
      },
      {
        id: 'W76',
        reason: '',
      },
    ],
  });
};
