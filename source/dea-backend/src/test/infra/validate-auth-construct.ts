/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Template } from 'aws-cdk-lib/assertions';

export const validateAuthConstruct = (template: Template): void => {
  // Assert single cognito user pool domain resource
  template.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
};
