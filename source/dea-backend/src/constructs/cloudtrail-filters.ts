/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FilterPattern } from 'aws-cdk-lib/aws-logs';

export const subscriptionFilter = FilterPattern.any(
  FilterPattern.exists('$.userIdentity.userName'),
  FilterPattern.exists('$.userIdentity.sessionContext.sessionIssuer.userName')
);
