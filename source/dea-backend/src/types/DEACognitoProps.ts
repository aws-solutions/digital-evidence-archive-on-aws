/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SecretValue } from 'aws-cdk-lib';

export interface DEACognitoProps {
  readonly cognitoDomain: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly userPoolClientSecret: SecretValue;
}
