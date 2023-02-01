/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CfnOutput, CfnOutputProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// methods created to avoid linting/sonarqube errors related to unused objects (eslint no-new)
export const createCfnOutput = (scope: Construct, id: string, props: CfnOutputProps): CfnOutput => {
  return new CfnOutput(scope, id, props);
};
