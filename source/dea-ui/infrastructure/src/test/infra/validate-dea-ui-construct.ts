/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Template } from 'aws-cdk-lib/assertions';

export const validateDeaUiConstruct = (template: Template): void => {
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Description: 'Backend API',
  });

  template.hasResourceProperties('AWS::S3::Bucket', {
    AccessControl: 'LogDeliveryWrite',
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
};
